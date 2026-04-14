use super::{buf_reader, scope_shm};
use std::time::Duration;
use tokio::sync::RwLock;
use tokio::task::JoinHandle;

pub struct ScopeState(RwLock<Option<JoinHandle<()>>>);

impl ScopeState {
    pub fn new() -> Self {
        Self(RwLock::new(None))
    }

    pub async fn bind(
        &self,
        target: &str,
        bufnum: i32,
        count: i32,
        on_data: impl Fn(Vec<f32>) + Send + 'static,
    ) -> Result<(), String> {
        let mut guard = self.0.write().await;
        if let Some(handle) = guard.take() {
            handle.abort();
        }

        let target = target.to_string();
        let handle = tokio::spawn(async move {
            // Parse host:port for SHM detection
            let (host, port) = parse_target(&target);
            let is_localhost = host == "127.0.0.1" || host == "localhost";
            let mut use_shm = false;

            // Probe SHM on first iteration for localhost
            if is_localhost {
                if let Ok(floats) = scope_shm::read_scope(port, count as usize) {
                    if !floats.is_empty() {
                        use_shm = true;
                        on_data(floats);
                    }
                }
            }

            loop {
                let result = if use_shm {
                    scope_shm::read_scope(port, count as usize)
                } else {
                    buf_reader::read_buffer(&target, bufnum, 0, count).await
                };

                match result {
                    Ok(floats) if !floats.is_empty() => {
                        on_data(floats);
                        tokio::time::sleep(Duration::from_millis(16)).await;
                    }
                    Ok(_) => tokio::time::sleep(Duration::from_millis(50)).await,
                    Err(_) => {
                        // If SHM fails, fall back to OSC
                        if use_shm {
                            use_shm = false;
                        }
                        tokio::time::sleep(Duration::from_millis(100)).await;
                    }
                }
            }
        });

        *guard = Some(handle);
        Ok(())
    }

    pub async fn unbind(&self) {
        let mut guard = self.0.write().await;
        if let Some(handle) = guard.take() {
            handle.abort();
        }
    }
}

fn parse_target(target: &str) -> (&str, u16) {
    match target.rsplit_once(':') {
        Some((host, port)) => (host, port.parse().unwrap_or(57110)),
        None => (target, 57110),
    }
}
