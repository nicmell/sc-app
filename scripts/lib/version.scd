// Phase 39 hotfix follow-up: capture scsynth /version reply at
// sclang boot. Eliminates the bridge's direct /version OSC
// handshake — sclang is already connected to scsynth (via s.notify
// + s.sync above), so we route the round-trip through there and
// surface the result as part of the /bootstrap/hello reply
// alongside clock + scope + dirt metadata.
//
// On timeout (~exotic scsynth fork, or scsynth quit between notify
// and version) the version key stays nil; the bootstrap responder
// emits an empty /bootstrap/scsynth-version message and the
// dashboard footer renders "scsynth (version unknown)".

(
~scAppInstallVersion = {
    var reply = nil;
    var done = Condition.new;
    var func;
    func = OSCFunc({ |msg|
        reply = msg;
        done.unhang;
    }, '/version.reply', s.addr);
    // Safety timeout — wakes the Condition even if scsynth never
    // replies. SC's /version is normally <10ms; 2s is a wide
    // margin for laggy networks / cold caches. Idempotent
    // unhang: if the OSCFunc already fired, this is a no-op.
    SystemClock.sched(2.0, { done.unhang; nil });
    s.sendMsg('/version');
    done.hang;
    func.free;  // safe whether or not it auto-fired

    if(reply.notNil) {
        // /version.reply progName major minor patch branch commitHash
        ~scAppBootstrapCtx[\scsynthVersion] = (
            progName: reply[1].asString,
            major: reply[2].asInteger,
            minor: reply[3].asInteger,
            patch: reply[4].asString,
            branch: reply[5].asString,
            commitHash: reply[6].asString
        );
        "[sc-app] scsynth /version captured: % %.%%".format(
            ~scAppBootstrapCtx[\scsynthVersion][\progName],
            ~scAppBootstrapCtx[\scsynthVersion][\major],
            ~scAppBootstrapCtx[\scsynthVersion][\minor],
            ~scAppBootstrapCtx[\scsynthVersion][\patch]
        ).postln;
    } {
        "[sc-app] scsynth /version timed out — bootstrap will report version=null".warn;
    };
};
)
