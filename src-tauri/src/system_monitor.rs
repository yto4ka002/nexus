use serde::Serialize;
use std::sync::Mutex;
use std::time::Instant;
use sysinfo::{CpuRefreshKind, Disks, MemoryRefreshKind, Networks, ProcessesToUpdate, System};

pub struct MonitorState {
    pub sys: Mutex<System>,
    pub networks: Mutex<Networks>,
    pub last_net_check: Mutex<Instant>,
    pub last_net_rx: Mutex<u64>,
    pub last_net_tx: Mutex<u64>,
}

#[derive(Serialize, Clone, Debug)]
pub struct CpuCoreInfo {
    pub name: String,
    pub usage: f32,
    pub frequency: u64,
}

#[derive(Serialize, Clone, Debug)]
pub struct DiskInfo {
    pub name: String,
    pub mount_point: String,
    pub total_gb: f64,
    pub available_gb: f64,
    pub used_gb: f64,
    pub usage_percent: f32,
    pub file_system: String,
    pub is_removable: bool,
}

#[derive(Serialize, Clone, Debug)]
pub struct ProcessItem {
    pub pid: u32,
    pub name: String,
    pub memory_mb: f64,
    pub cpu_percent: f32,
}

#[derive(Serialize, Clone, Debug)]
pub struct SystemStats {
    pub cpu_name: String,
    pub cpu_cores: usize,
    pub cpu_overall_percent: f32,
    pub cpu_cores_detail: Vec<CpuCoreInfo>,
    pub ram_total_mb: u64,
    pub ram_used_mb: u64,
    pub ram_free_mb: u64,
    pub ram_percent: f32,
    pub disks: Vec<DiskInfo>,
    pub net_rx_speed_kb: f64,
    pub net_tx_speed_kb: f64,
    pub net_total_rx_mb: f64,
    pub net_total_tx_mb: f64,
    pub gpu_available: bool,
    pub gpu_name: String,
    pub gpu_usage_percent: Option<f32>,
    pub top_processes: Vec<ProcessItem>,
    pub uptime_seconds: u64,
}

impl MonitorState {
    pub fn new() -> Self {
        let mut sys = System::new();
        sys.refresh_cpu_all();
        sys.refresh_memory();
        let networks = Networks::new_with_refreshed_list();

        Self {
            sys: Mutex::new(sys),
            networks: Mutex::new(networks),
            last_net_check: Mutex::new(Instant::now()),
            last_net_rx: Mutex::new(0),
            last_net_tx: Mutex::new(0),
        }
    }

    pub fn get_stats(&self) -> SystemStats {
        let mut sys = self.sys.lock().unwrap();
        sys.refresh_cpu_specifics(CpuRefreshKind::everything());
        sys.refresh_memory_specifics(MemoryRefreshKind::everything());
        sys.refresh_processes(ProcessesToUpdate::All);

        // CPU
        let cpu_overall_percent = sys.global_cpu_usage();
        let cpu_name = sys
            .cpus()
            .first()
            .map(|c| c.brand().to_string())
            .unwrap_or_else(|| "Unknown CPU".to_string());
        let cpu_cores = sys.cpus().len();
        let cpu_cores_detail: Vec<CpuCoreInfo> = sys
            .cpus()
            .iter()
            .map(|c| CpuCoreInfo {
                name: c.name().to_string(),
                usage: c.cpu_usage(),
                frequency: c.frequency(),
            })
            .collect();

        // RAM
        let ram_total_mb = sys.total_memory() / 1024 / 1024;
        let ram_used_mb = sys.used_memory() / 1024 / 1024;
        let ram_free_mb = sys.free_memory() / 1024 / 1024;
        let ram_percent = if ram_total_mb > 0 {
            (ram_used_mb as f32 / ram_total_mb as f32) * 100.0
        } else {
            0.0
        };

        // Disks
        let disks_list = Disks::new_with_refreshed_list();
        let disks: Vec<DiskInfo> = disks_list
            .iter()
            .map(|d| {
                let total_gb = d.total_space() as f64 / 1024.0 / 1024.0 / 1024.0;
                let avail_gb = d.available_space() as f64 / 1024.0 / 1024.0 / 1024.0;
                let used_gb = (total_gb - avail_gb).max(0.0);
                let usage_percent = if total_gb > 0.0 {
                    ((used_gb / total_gb) * 100.0) as f32
                } else {
                    0.0
                };
                DiskInfo {
                    name: d.name().to_string_lossy().to_string(),
                    mount_point: d.mount_point().to_string_lossy().to_string(),
                    total_gb: (total_gb * 10.0).round() / 10.0,
                    available_gb: (avail_gb * 10.0).round() / 10.0,
                    used_gb: (used_gb * 10.0).round() / 10.0,
                    usage_percent,
                    file_system: d.file_system().to_string_lossy().to_string(),
                    is_removable: d.is_removable(),
                }
            })
            .collect();

        // Network
        let mut net_lock = self.networks.lock().unwrap();
        net_lock.refresh();
        let mut total_rx: u64 = 0;
        let mut total_tx: u64 = 0;
        for (_interface_name, data) in net_lock.iter() {
            total_rx += data.total_received();
            total_tx += data.total_transmitted();
        }

        let mut last_time = self.last_net_check.lock().unwrap();
        let mut last_rx = self.last_net_rx.lock().unwrap();
        let mut last_tx = self.last_net_tx.lock().unwrap();
        let elapsed = last_time.elapsed().as_secs_f64().max(0.1);

        let rx_delta = total_rx.saturating_sub(*last_rx);
        let tx_delta = total_tx.saturating_sub(*last_tx);

        let net_rx_speed_kb = (rx_delta as f64 / elapsed / 1024.0).max(0.0);
        let net_tx_speed_kb = (tx_delta as f64 / elapsed / 1024.0).max(0.0);

        *last_time = Instant::now();
        *last_rx = total_rx;
        *last_tx = total_tx;

        let net_total_rx_mb = (total_rx as f64 / 1024.0 / 1024.0 * 10.0).round() / 10.0;
        let net_total_tx_mb = (total_tx as f64 / 1024.0 / 1024.0 * 10.0).round() / 10.0;

        // Processes (top 15 by memory)
        let mut processes: Vec<ProcessItem> = sys
            .processes()
            .iter()
            .map(|(pid, p)| ProcessItem {
                pid: pid.as_u32(),
                name: p.name().to_string_lossy().to_string(),
                memory_mb: ((p.memory() as f64 / 1024.0 / 1024.0) * 10.0).round() / 10.0,
                cpu_percent: (p.cpu_usage() * 10.0).round() / 10.0,
            })
            .collect();

        processes.sort_by(|a, b| b.memory_mb.partial_cmp(&a.memory_mb).unwrap_or(std::cmp::Ordering::Equal));
        processes.truncate(15);

        let uptime_seconds = System::uptime();

        SystemStats {
            cpu_name,
            cpu_cores,
            cpu_overall_percent: (cpu_overall_percent * 10.0).round() / 10.0,
            cpu_cores_detail,
            ram_total_mb,
            ram_used_mb,
            ram_free_mb,
            ram_percent: (ram_percent * 10.0).round() / 10.0,
            disks,
            net_rx_speed_kb: (net_rx_speed_kb * 10.0).round() / 10.0,
            net_tx_speed_kb: (net_tx_speed_kb * 10.0).round() / 10.0,
            net_total_rx_mb,
            net_total_tx_mb,
            gpu_available: false,
            gpu_name: "Hardware accelerated graphics".to_string(),
            gpu_usage_percent: None,
            top_processes: processes,
            uptime_seconds,
        }
    }
}
