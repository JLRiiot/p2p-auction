## TODOs

- [x] Get client example running
- [x] Get server example running
- [x] Modify server and client to accept `peerName`
- [x] Modify Server and Client to destroy `rpc` and `dht` when process finishes
- [ ] ~~Connect to peer using it's `publickKey`~~
- [x] Use peer public key to make RPC calls
- [ ] **OPTIONAL** rpc call to get peer prefered name (`peer-name`) to improve `UX`
- [ ] Show a prompt when peer disconets
- [x] Peer Client: create `sell` command
- [ ] Peer Client/Server: notify other parties about the new auction
- [x] Peer Server: create `bid` command
- [ ] Peer Server: propagate/notify other parties about the new bid
- [ ] Peer Client: create `terminate` sell command
- [ ] Peer Client: propagate/notify other parties about the termination of the `sell_order`
- [ ] Peer Server: fail `bid` if `sell_order` is `terminated`
- [ ] Peer Server: fail `bid` if the price is not bigger than current
- [ ] Peer Server: propagate auction status
- [ ] Make sure auction status of each `peer` is only available when `peer` is online
