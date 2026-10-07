// Package core holds the domain and use cases of the Cero API, shared by every
// Go implementation. No framework, no database: plain structs and functions.
//
// It is a port of the TypeScript reference core (shared/typescript-core).
// A transport builds the use cases with [NewServices], plugging in a storage
// adapter: package memory, or a database adapter such as database/go-postgres.
// Package coretest holds the storage contract every adapter must honour.
package core
