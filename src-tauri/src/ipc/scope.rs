use super::buf_reader;
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
            loop {
                match buf_reader::read_buffer(&target, bufnum, 0, count).await {
                    Ok(floats) if !floats.is_empty() => on_data(floats),
                    Ok(_) => tokio::time::sleep(Duration::from_millis(50)).await,
                    Err(_) => tokio::time::sleep(Duration::from_millis(100)).await,
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
