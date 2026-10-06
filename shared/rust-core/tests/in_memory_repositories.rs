//! The in-memory adapter honours the repository contract, like every database adapter.

use cero_core::{Repositories, in_memory};

async fn empty_storage() -> Repositories {
    in_memory::repositories()
}

cero_core::repository_contract_tests!(empty_storage);
