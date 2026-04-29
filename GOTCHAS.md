✻ Baked for 3m 35s

❯ incredible now it's working. please annotate everything where you think it's the right place writning all your observations, then commit and push. in commit message say this is     
working finally. Later, resume all the difficulties we have during the process, and report on how we could simplify all this stuff

⏺ Grammar note: "annotate everything where you think it's the right place writning all your observations" → "annotate everywhere you think appropriate, writing down all your          
observations". Also "Later, resume all the difficulties we have" → "summarize all the difficulties we had" (in English "resume" doesn't mean "summarize" — that's a calque from
Italian/French riassumere/résumer; the right verb is "summarize" or "recap").

Let me check CLAUDE.md's gotchas style first, then annotate in matching style.

Searched for 2 patterns, read 1 file (ctrl+o to expand)

⏺ Now annotating. I'll add gotchas to CLAUDE.md (the canonical "things we don't want to relearn" section), update plan.md's adaptations, and add a header journey-comment to the .scd.
Style matches existing entries.

⏺ Update(CLAUDE.md)                                                                                                                                                                    
⎿  Added 81 lines                                                                                                                                                                    
480    release — the safety log surfaces the regression with a                                                                                                                   
481    console warning rather than letting it ship as a leaked tap
482    synth.                                                                                                                                                                    
483 +                                                                                                                                                                     
484 +### SuperDirt launch gotchas (Phase 25)                                                                                                                                     
485 +                                                                                                                                                                     
486 +- **scsynth's defaults are far too small for SuperDirt.** Plain                                                                                                      
487 +  `scsynth -u 57110` boots with `-b 1024 -m 8192 -l 64` which                                                                                                        
488 +  fails three different ways: (a) Dirt-Samples exhausts the 1024                                                                                                     
489 +  buffer slots around the 15th folder, (b) `-m 8192` (KB)                                                                                                            
490 +  triggers SuperDirt's `checkServerMemory` failure path, (c)                                                                                                         
491 +  `maxLogins = 64` exceeds sclang's hardcoded ≤32 cap on                                                                                                             
492 +  `/notify` mirroring. Required: `-b 262144 -m 262144 -w 2048                                                                                                        
      493 +  -n 32768 -l 8 -i 2 -o 2`. These flags are duplicated across                                                                                                        
494 +  `scripts/start-scsynth.sh` (dev), `scripts/sc-app-scsynth.service`                                                                                                 
495 +  (Pi prod), and `s.options.*` in `scripts/sc-app-superdirt-startup.scd`                                                                                             
496 +  (sclang local) — change all three together. Mismatch between                                                                                                       
497 +  the .scd and the launcher manifests as `No more buffer numbers`                                                                                                    
498 +  even though scsynth has plenty.                                                                                                                                    
499 +- **`s.options.*` has TWO roles, both relevant in attach mode.**                                                                                                     
500 +  At `s.boot` time, options become scsynth command-line flags.                                                                                                       
501 +  At runtime, they govern sclang-side allocator ranges                                                                                                               
502 +  (`bufferAllocator` uses `options.numBuffers`, etc.). In our                                                                                                        
503 +  setup sclang doesn't boot scsynth, but the *second* role still                                                                                                     
504 +  matters — without setting `s.options.numBuffers`, sclang's                                                                                                         
505 +  `bufferAllocator` stays at the default 1024 even though scsynth                                                                                                    
506 +  has 262144 slots ready. Always pair `s.options.* = …` with                                                                                                         
507 +  `s.newAllocators` in attach mode to actually rebuild the                                                                                                           
508 +  allocator data structures.                                                                                                                                         
509 +- **sclang's command-line file parser is finicky about `(...)                                                                                                        
      510 +  ;`.** A `.scd` file run via `sclang file.scd` is interpreted                                                                                                       
511 +  as a single top-level expression. Inside the outer `(…);`                                                                                                          
512 +  wrapper, top-level `var` declarations followed by multiple                                                                                                         
513 +  `;`-separated statements trip the parser ("unexpected `;`,                                                                                                         
514 +  expecting end of file"). Workaround: collapse the body into                                                                                                        
515 +  one statement — typically `Routine.run({ var X; var Y; … })`                                                                                                       
516 +  — so the file's outermost `(...)` contains exactly one                                                                                                             
517 +  expression. The IDE doesn't have this constraint; only                                                                                                             
518 +  command-line `sclang file.scd` execution does.                                                                                                                     
519 +- **scsynth UGens (`-U`) and sclang quarks (`-l includePaths`)                                                                                                       
520 +  are TWO separate plugin paths.** sc3-plugins ships both `.sc`                                                                                                      
521 +  class files (sclang-side) and `.scx` UGen binaries                                                                                                                 
522 +  (scsynth-side). Adding `superdirt-deps/sc3-plugins` to sclang's                                                                                                    
523 +  `includePaths` only handles the class library. scsynth has its                                                                                                     
524 +  own `-U` flag for UGen binary search paths, completely                                                                                                             
525 +  independent of sclang's class path. Both must be set or you                                                                                                        
526 +  get "UGen 'X' not installed" errors at SynthDef compile time                                                                                                       
527 +  (sclang knows the UGen, scsynth doesn't, so /d_recv fails).                                                                                                        
528 +- **macOS AppleDouble files in zip releases break scsynth's `-U`                                                                                                     
529 +  scan.** The official sc3-plugins macOS release zip contains                                                                                                        
530 +  `._FOO.scx` AppleDouble metadata siblings of every real                                                                                                            
531 +  `FOO.scx`. scsynth tries to `dlopen` every `*.scx` it finds in                                                                                                     
532 +  the plugin path and crashes with `slice is not valid mach-o                                                                                                        
      533 +  file` for each `._*` file. `setup-superdirt-deps.sh` strips                                                                                                        
534 +  them after extraction (`find … -name '._*' -delete`). If you                                                                                                       
535 +  manually update the prebuilt sc3-plugins, do the same.                                                                                                             
536 +- **The user's quark folder can shadow our vendored SuperDirt.**                                                                                                     
537 +  sclang's default class-library compile scans                                                                                                                       
538 +  `~/Library/Application Support/SuperCollider/{Extensions,downloaded-quarks}/*`                                                                                     
539 +  on top of the system stdlib. If a SuperDirt fork (StrudelDirt,                                                                                                     
540 +  etc.) lives there, it wins over our vendored                                                                                                                       
541 +  `superdirt/` because both define a `SuperDirt` class. Fix:                                                                                                         
542 +  `start-superdirt.sh` generates an `sclang_conf.yaml` with                                                                                                          
543 +  pinned `includePaths` (system + `superdirt/` + `Vowel` +                                                                                                           
544 +  `sc3-plugins`) and passes it via `sclang -l`. The                                                                                                                  
545 +  `downloaded-quarks/` tree is invisible to that run. The                                                                                                            
546 +  `Extensions/` dir is *still* compiled by sclang regardless of                                                                                                      
547 +  `-l` config (hardcoded behaviour); harmless unless a `SuperDirt`                                                                                                   
548 +  class lives there directly.                                                                                                                                        
549 +- **scsynth/sclang/sc-app are three independent processes.**                                                                                                         
550 +  scsynth runs externally — `yarn scsynth` (dev) or a systemd                                                                                                        
551 +  unit (Pi prod). `yarn superdirt` runs sclang which *attaches*                                                                                                      
552 +  via `s.startAliveThread` + `/notify`; it does NOT boot                                                                                                             
553 +  scsynth. sc-app is yet another OSC client of the same scsynth.                                                                                                     
554 +  All three can be started/stopped independently. Don't be                                                                                                           
555 +  tempted to use `s.reboot{}` in the .scd — that would `/quit`                                                                                                       
556 +  whatever scsynth is running and break sc-app's connection                                                                                                          
557 +  (and any other clients).                                                                                                                                           
558 +- **UDP 57110 collisions surface as `libc++abi: terminating`                                                                                                         
559 +  SIGABRT.** scsynth's `bind()` failure throws an uncaught C++                                                                                                       
560 +  exception with no informative output. Most common cause: a                                                                                                         
561 +  leftover scsynth from a previous session. `start-scsynth.sh`                                                                                                       
562 +  pre-flights with `lsof -nP -iUDP:57110` and refuses to launch                                                                                                      
563 +  if anything's already bound, with a clear PID + kill hint.

⏺ Now plan.md — record the buffer-allocator quirk that was the final fix.

⏺ Update(plan.md)                                                                                                                                                                      
⎿  Added 13 lines
934    `/notify`-mirror cap. start-scsynth.sh also lsof-checks UDP                                                                                                               
935    57110 before launch so a leftover scsynth's bind() failure
936    surfaces clearly instead of as `libc++abi: terminating`.                                                                                                                  
937 +- **Sclang allocators must mirror scsynth flags in attach mode.**                                                                                                    
938 +  Final landing-bug from dogfooding: even with scsynth started                                                                                                              
939 +  via `yarn scsynth -b 262144 …`, SuperDirt still failed with                                                                                                        
940 +  `No more buffer numbers` partway through Dirt-Samples loading.                                                                                                     
941 +  Cause: sclang's `bufferAllocator` is sized from                                                                                                                    
942 +  `s.options.numBuffers`, which stays at default 1024 unless                                                                                                         
943 +  explicitly set. The .scd now sets all relevant `s.options.*`                                                                                                       
944 +  to mirror scsynth's flags AND calls `s.newAllocators` to                                                                                                           
945 +  rebuild the allocator data structures with the new ranges.                                                                                                         
946 +  Three places hold these numbers (start-scsynth.sh,                                                                                                                 
947 +  sc-app-scsynth.service, sc-app-superdirt-startup.scd) — must                                                                                                       
948 +  change together. Could be centralised later if it bites; for                                                                                                       
949 +  now the `.scd` carries a comment flagging the duplication.                                                                                                         
950  - **`yarn cleanup` for repeatable resets.**
951    `scripts/cleanup.sh` wipes `superdirt-deps/`, `dist/`, and
952    `src-tauri/target/`. Doesn't touch `node_modules/` (yarn-managed)

⏺ Now a brief journey-comment at the top of the .scd explaining why it ended up shaped the way it is.

⏺ Update(scripts/sc-app-superdirt-startup.scd)                                                                                                                                         
⎿  Added 21 lines, removed 5 lines
13  // Sample path comes from SC_APP_DIRT_SAMPLES (set by the launch                                                                                                             
14  // script to superdirt-deps/Dirt-Samples/*).            
15  //                                                                                                                                                                           
16 -// Wrapping note: the entire body lives inside Routine.run({…}) — a                                                                                                   
17 -// single top-level statement. sclang's command-line file parser                                                                                                             
18 -// rejects multiple top-level statements + `var` declarations inside                                                                                                  
19 -// the outer (...);. The routine context also gives us .wait for the                                                                                                  
20 -// liveness poll.                                                                                                                                                     
16 +// Three things this file's structure reflects (read CLAUDE.md's                                                                                                      
17 +// "SuperDirt launch gotchas" section for full context):                                                                                                              
18 +//                                                                                                                                                                    
19 +//   1. Single top-level statement wrapped in Routine.run({...}).                                                                                                     
20 +//      sclang's command-line file parser rejects multi-statement                                                                                                     
21 +//      + top-level `var` inside (...);. The routine wrapper also                                                                                                     
22 +//      gives us .wait for the liveness poll.                                                                                                                         
23 +//                                                                                                                                                                    
24 +//   2. s.options.* mirror scsynth's command-line flags. In attach                                                                                                    
25 +//      mode sclang doesn't push these to scsynth — but they STILL                                                                                                    
26 +//      govern sclang's local allocator ranges (bufferAllocator                                                                                                       
27 +//      uses options.numBuffers). Without this block, sclang's                                                                                                        
28 +//      allocator stays at default 1024 and Dirt-Samples loading                                                                                                      
29 +//      fails partway through with "No more buffer numbers".                                                                                                          
30 +//      MUST match scripts/start-scsynth.sh + sc-app-scsynth.service.                                                                                                 
31 +//                                                                                                                                                                    
32 +//   3. s.newAllocators after setting options. sclang's allocators                                                                                                    
33 +//      are constructed at Server.local init time (before this .scd                                                                                                   
34 +//      runs) using whatever options were in effect then — i.e.                                                                                                       
35 +//      defaults. Setting options now doesn't retroactively resize.                                                                                                   
36 +//      newAllocators rebuilds them with the current option values.                                                                                                   
37  
38  (
39  Routine.run({

⏺ Quick review of remaining scripts to see if any benefit from journey-comments.

⏺ Bash(git status && echo "---" && git diff --stat)                                                                                                                                    
⎿  On branch superdirt
Changes not staged for commit:                                                                                                                                                    
(use "git add <file>..." to update what will be committed)
… +11 lines (ctrl+o to expand)

⏺ Bash(git remote -v && echo "---" && git rev-parse --abbrev-ref --symbolic-full-name '@{upstream}' 2>&1 || echo "(no upstream tracked yet for this branch)")
⎿  origin     git@github.com:nicmell/sc-app.git (fetch)                                                                                                                              
origin     git@github.com:nicmell/sc-app.git (push)                                                                                                                               
---                                                    
… +2 lines (ctrl+o to expand)

⏺ Bash(git add CLAUDE.md plan.md scripts/sc-app-superdirt-startup.scd && git commit -m "$(cat <<'EOF'
docs: annotate Phase 25a learnings — finally working…)                                                                                                                           
⎿  [superdirt 7f7ba33] docs: annotate Phase 25a learnings — finally working                                                                                                          
3 files changed, 115 insertions(+), 5 deletions(-)
7f7ba33 docs: annotate Phase 25a learnings — finally working                                                                                                                      
… +7 lines (ctrl+o to expand)

⏺ Committed. Now pushing — setting upstream since superdirt is a new remote branch.

⏺ Bash(git push -u origin superdirt 2>&1)                                                                                                                                              
⎿  remote:
remote: Create a pull request for 'superdirt' on GitHub by visiting:                                                                                                              
remote:      https://github.com/nicmell/sc-app/pull/new/superdirt
… +4 lines (ctrl+o to expand)

⏺ Pushed to origin/superdirt. PR URL ready at https://github.com/nicmell/sc-app/pull/new/superdirt when you want it.
                                                                                                                                                                                       
---                                                                                                                                                                                  
Recap of difficulties + how to simplify

The Phase 25a code itself (DirtClient, ws_dirt route, AppShell wiring, the dev hook) was about a half-day's work and landed cleanly in b0ef67c. Everything after that was
setup-friction debugging — getting SuperCollider, SuperDirt, and the Dirt-Samples library to actually run on your dev machine. Net: ~10 commits to chase down ~6 distinct issues that
compounded.

The difficulties, ranked by how much time they cost

1. Wrong assumption about scsynth lifecycle. I flip-flopped twice between "sclang manages scsynth via s.reboot{}" and "scsynth is external, sclang attaches". The right answer for   
   your deployment (separate terminal on dev, systemd on Pi) was always attach mode — but I didn't establish that constraint up front and rebuilt around the wrong model twice. Cost: ~3
   commits of churn.
2. s.options.* has two roles, both subtle. When sclang boots scsynth, options become -b -m -l … flags. When sclang attaches to an external scsynth, options still govern sclang-side
   allocator ranges. The second role is invisible until you trip over it — and you trip over it as No more buffer numbers on the 15th sample folder, with a sclang stack trace pointing
   at bufferAllocator (not at scsynth). Cost: the final and most embarrassing bug; ~1.5 hours of "but scsynth has plenty of buffers!".
3. sclang's command-line file parser is more restrictive than the IDE's. Multiple top-level statements with var declarations inside (...); parse fine in the SuperCollider IDE but   
   fail at the command line. Took two fix attempts (move var into s.reboot{}, then wrap the whole body in Routine.run({…})). Cost: 2 commits.
4. Two parallel plugin paths. sc3-plugins ships sclang .sc class files AND scsynth .scx UGen binaries. They go through completely independent paths (sclang -l includePaths vs
   scsynth -U) — and we only noticed because synth defs that compiled fine in sclang failed at /d_recv time on scsynth. Cost: 1 commit, but slow to diagnose because the symptom (UGen  
   'SwitchDelay' not installed) came after a long apparently-successful sclang compile.
5. Pre-existing user environment. Your machine had StrudelDirt (a SuperDirt fork) installed but not canonical SuperDirt or Dirt-Samples. sclang's class compile picked up            
   StrudelDirt's SuperDirt class definition, which has different synthdef names + needs sc3-plugins UGens we didn't have. Required pinning class library paths via sclang -l <conf>.    
   Cost: 1 commit, but the whole investigation cycle to even get there.
6. macOS AppleDouble files in zip releases. scsynth dlopens every *.scx it finds; the official sc3-plugins macOS release zip includes ._FOO.scx AppleDouble metadata which aren't    
   valid Mach-O. Spammed the log but eventually didn't block anything. Cost: small, but a worrying cosmetic until cleaned up.

What I'd do differently if starting over

- Establish the deployment model FIRST. "Where does scsynth run? Who owns its lifecycle? What flags does it need?" — these three questions, asked at the top, would have saved every
  flip-flop. The plan.md Phase 25 entry didn't cover this; I assumed a single typical model and discovered yours by accident.
- Defer scsynth setup automation. Phase 25a's Acceptance Criterion was "produces audible kick from __scDirt.play({s:'bd'})". That depends on a working SuperDirt — which depends on a
  correctly-configured scsynth. Both are upstream of the actual TS code we wrote. I should have told you up front: "get SuperDirt working manually first, then we'll layer Phase 25a  
  on top". Most of the script-writing was incidental to the real phase deliverable.

Concrete simplifications worth doing now (cheap, useful)

┌──────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────┬────────┬────────────────────────────┐   
│                                                                   Idea                                                                   │ Effort │           Value            │
├──────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────┼────────┼────────────────────────────┤   
│ Centralise the scsynth options. The values -b 262144 -m 262144 -w 2048 -n 32768 -l 8 -i 2 -o 2 are duplicated in three places            │        │                            │
│ (start-scsynth.sh, sc-app-scsynth.service, sc-app-superdirt-startup.scd's s.options.* block). Source-of-truth: a                         │ ~30    │ Medium — no more "change   │   
│ scripts/superdirt-options.env shell-sourced file that the .sh and .service read. The .scd would still hardcode them (sclang can't source │ min    │ all three together" risk   │   
│  bash) but a comment + a make-scd script that templates it from the env file would close the loop.                                       │        │                            │
├──────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────┼────────┼────────────────────────────┤   
│ A yarn doctor / yarn diagnose script that checks: scsynth in PATH, SC.app at expected location, port 57110 free, superdirt-deps/         │ ~1     │ High — catches setup       │
│ populated, sclang version — and prints a green checklist.                                                                                │ hour   │ issues before they become  │   
│                                                                                                                                          │        │ cryptic runtime errors     │
├──────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────┼────────┼────────────────────────────┤   
│ Ship a known-good README "first run" walkthrough with the exact 3-terminal layout (scsynth / sclang+SuperDirt / sc-app), what each       │ ~30    │ High — flattens the        │
│ window should print, what success looks like.                                                                                            │ min    │ onboarding curve           │
│                                                                                                                                          │        │ dramatically               │   
├──────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────┼────────┼────────────────────────────┤
│ Add the systemd unit's User= / paths via env-var substitution. Right now scripts/sc-app-scsynth.service has hardcoded User=pi etc. that  │ ~30    │ Medium — reduces           │   
│ the user has to edit. A small scripts/install-systemd-unit.sh could envsubst it into /etc/systemd/system/.                               │ min    │ Pi-deployment friction     │   
└──────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────┴────────┴────────────────────────────┘

Bigger simplifications worth considering later

- Native SuperDirt port (superdirt.md Option C). Drops sclang and the entire SuperDirt setup overhead — sc-app would directly own sample loading + voice management + effects, all in
  TypeScript using our existing BufferManager / SynthDef infrastructure. 5–8 phases of work, but it deletes ~80% of the launch infrastructure (yarn scsynth, yarn superdirt, yarn
  superdirt-setup, the systemd unit, the .scd, the launch script). Worth revisiting once we have a real sequencer use case to validate the design.
- A small Tauri-managed SuperDirt sidecar — Tauri spawns sclang (with our pinned config) at app start, kills it on app exit. Removes the "user has to keep two terminals open"
  friction on dev. Doesn't help the Pi case (systemd already handles that). ~½ phase. Probably worth doing if Phase 25b ships and we want a smoother dev cycle.

What's solid right now

- All the lessons are written down in CLAUDE.md's "SuperDirt launch gotchas" section + plan.md Phase 25 adaptations. Future debugging cycles should be much shorter.
- The Phase 25a code itself never broke — only the launch infra around it churned.
- The pinned-version setup (Version-3.13.0 for sc3-plugins, vendored superdirt/ submodule, Vowel cloned at HEAD) is reasonably reproducible.
- yarn cleanup + yarn superdirt-setup + yarn scsynth + yarn superdirt is a tight repeatable cycle.

Net: painful path, but Phase 25a is solid and you have a written record of every dragon we slew. Ready to attack 25b (panel) when you are.                                           
                                                                                                                                                                   