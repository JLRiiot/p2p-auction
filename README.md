## Part of the challenge TODOs

- [x] Peer Client: create `sell` command
- [x] Peer Client/Server: notify other parties about the new auction
- [x] Peer Server: create `bid` command
- [x] Peer Server: propagate/notify other parties about the new bid
- [x] Peer Client: create `terminate` sell command
- [x] Peer Client: propagate/notify other parties about the termination of the `sell_order`
- [x] Peer Server: propagate auction status

### Good To Have TODOs

- [x] Get client example running
- [x] Get server example running
- [x] Modify server and client to accept `peerName`
- [x] Modify Server and Client to destroy `rpc` and `dht` when process finishes
- [x] Use peer public key to make RPC calls
- [ ] **OPTIONAL** rpc call to get peer prefered name (`peer-name`) to improve `UX`
- [ ] Show a prompt when peer disconets
- [ ] Peer Server: fail `bid` if `sell_order` is `terminated`
- [ ] Peer Server: fail `bid` if the price is not bigger than current
