// Phase 27a: /dirt/listSamples responder. Frontend's sequencer
// panel populates a sample-name autocomplete from the banks
// SuperDirt actually has loaded. SuperDirt itself exposes
// nothing for this — the dict lives on `~dirt.buffers`, keyed by
// Symbol with Array-of-BufferProxy values. We flatten it into an
// interleaved `[name1, count1, name2, count2, …]` reply on
// /dirt/samples.
//
// `addr` is the sender (the bridge's per-route UDP socket in
// Phase 26 deployments); sendMsg back there and the bridge fans
// it onto the WebSocket the original request came in on.
//
// Must run AFTER `~scAppInstallSuperDirt.()` since it reads
// `~dirt.buffers`.
(
~scAppInstallDirtListSamples = {
    OSCdef(\scAppListSamples, { |msg, time, addr|
        var args = List.new;
        if(~dirt.notNil) {
            ~dirt.buffers.keysValuesDo { |name, list|
                args.add(name.asString);
                args.add(list.size);
            };
        };
        addr.sendMsg('/dirt/samples', *args);
    }, '/dirt/listSamples');
    "[sc-app] /dirt/listSamples responder installed".postln;
};
)
