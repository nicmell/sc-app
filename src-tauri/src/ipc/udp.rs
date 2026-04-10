use std::sync::Arc;
use tokio::net::UdpSocket;
use tokio::sync::RwLock;
use tokio::task::JoinHandle;

struct UdpEntry {
    task: JoinHandle<()>,
    sock: Arc<UdpSocket>,
}

pub struct UdpState(RwLock<Option<UdpEntry>>);

impl UdpState {
    pub fn new() -> Self {
        Self(RwLock::new(None))
    }

    pub async fn bind(
        &self,
        local_addr: &str,
        on_data: impl Fn(&[u8]) + Send + 'static,
    ) -> Result<(), String> {
        let mut guard = self.0.write().await;

        // Abort any existing recv task
        if let Some(entry) = guard.take() {
            entry.task.abort();
        }

        let sock = UdpSocket::bind(local_addr)
            .await
            .map_err(|e| e.to_string())?;
        let arc = Arc::new(sock);
        let recv_sock = arc.clone();

        let task = tokio::task::spawn(async move {
            let mut buf = [0u8; 65536];
            loop {
                match recv_sock.recv_from(&mut buf).await {
                    Ok((len, _)) => on_data(&buf[..len]),
                    Err(_) => break,
                }
            }
        });

        *guard = Some(UdpEntry { task, sock: arc });
        Ok(())
    }

    pub async fn send(&self, target: &str, data: &[u8]) -> Result<usize, String> {
        let guard = self.0.read().await;
        let entry = guard.as_ref().ok_or("Socket not bound")?;
        entry
            .sock
            .send_to(data, target)
            .await
            .map_err(|e| e.to_string())
    }

    pub async fn close(&self) -> Result<(), String> {
        let mut guard = self.0.write().await;
        if let Some(entry) = guard.take() {
            entry.task.abort();
        }
        Ok(())
    }
}
