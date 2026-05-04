// Phase 27a → 39b: pre-39 this installed an `/dirt/listSamples`
// OSCdef so the frontend could query SuperDirt's loaded banks
// at session-attach time. Phase 39b removed the round-trip:
// `~scAppInstallBootstrap` reads `~dirt.buffers` once at boot
// and includes the snapshot in the bootstrap reply (see
// `lib/bootstrap.scd`). Frontend's DirtClient seeds its
// `sampleBanks` store from `SessionInfo.dirtSamples`.
//
// This install function stays as a no-op to keep the
// orchestrator's load list stable — Phase 39e cleanup will
// drop the file entirely.
(
~scAppInstallDirtListSamples = {
    "[sc-app] /dirt/listSamples responder skipped (Phase 39b: bootstrap reply carries the sample list)".postln;
};
)
