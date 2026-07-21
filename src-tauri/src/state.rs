use parking_lot::RwLock;
use std::path::PathBuf;

#[derive(Default)]
pub struct AppState {
    pub repo_root: RwLock<Option<PathBuf>>,
    pub python_cmd: RwLock<String>,
}

impl AppState {
    pub fn new() -> Self {
        Self {
            repo_root: RwLock::new(None),
            python_cmd: RwLock::new("python".into()),
        }
    }

    pub fn repo(&self) -> Option<PathBuf> {
        self.repo_root.read().clone()
    }

    pub fn set_repo(&self, path: PathBuf) {
        *self.repo_root.write() = Some(path);
    }

    pub fn python(&self) -> String {
        self.python_cmd.read().clone()
    }

    pub fn set_python(&self, cmd: String) {
        *self.python_cmd.write() = cmd;
    }
}
