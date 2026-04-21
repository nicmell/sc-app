// @generated — DO NOT EDIT.
// Regenerate with `node scripts/generate_server_commands_rust.mjs`.

use crate::registry::CommandEntry;

pub(crate) const ALL_COMMANDS: &[CommandEntry] = &[
    CommandEntry {
        address: r"/b_alloc",
        category: r"buffer",
        description: r"Allocate buffer space.",
    },
    CommandEntry {
        address: r"/b_allocRead",
        category: r"buffer",
        description: r"Allocate buffer space and read a sound file.",
    },
    CommandEntry {
        address: r"/b_allocReadChannel",
        category: r"buffer",
        description: r"Allocate buffer space and read channels from a sound file.",
    },
    CommandEntry {
        address: r"/b_close",
        category: r"buffer",
        description: r"Close soundfile.",
    },
    CommandEntry {
        address: r"/b_fill",
        category: r"buffer",
        description: r"Fill ranges of sample value(s).",
    },
    CommandEntry {
        address: r"/b_free",
        category: r"buffer",
        description: r"Free buffer data.",
    },
    CommandEntry {
        address: r"/b_gen",
        category: r"buffer",
        description: r"Call a command to fill a buffer.",
    },
    CommandEntry {
        address: r"/b_get",
        category: r"buffer",
        description: r"Get sample value(s).",
    },
    CommandEntry {
        address: r"/b_getn",
        category: r"buffer",
        description: r"Get ranges of sample value(s).",
    },
    CommandEntry {
        address: r"/b_query",
        category: r"buffer",
        description: r"Get buffer info.",
    },
    CommandEntry {
        address: r"/b_read",
        category: r"buffer",
        description: r"Read sound file data into an existing buffer.",
    },
    CommandEntry {
        address: r"/b_readChannel",
        category: r"buffer",
        description: r"Read sound file channel data into an existing buffer.",
    },
    CommandEntry {
        address: r"/b_set",
        category: r"buffer",
        description: r"Set sample value(s).",
    },
    CommandEntry {
        address: r"/b_setn",
        category: r"buffer",
        description: r"Set ranges of sample value(s).",
    },
    CommandEntry {
        address: r"/b_setSampleRate",
        category: r"buffer",
        description: r"Set the sampling rate of the buffer.",
    },
    CommandEntry {
        address: r"/b_write",
        category: r"buffer",
        description: r"Write sound file data.",
    },
    CommandEntry {
        address: r"/b_zero",
        category: r"buffer",
        description: r"Zero sample data.",
    },
    CommandEntry {
        address: r"/c_fill",
        category: r"control",
        description: r"Fill ranges of bus value(s).",
    },
    CommandEntry {
        address: r"/c_get",
        category: r"control",
        description: r"Get bus value(s).",
    },
    CommandEntry {
        address: r"/c_getn",
        category: r"control",
        description: r"Get ranges of bus value(s).",
    },
    CommandEntry {
        address: r"/c_set",
        category: r"control",
        description: r"Set bus value(s).",
    },
    CommandEntry {
        address: r"/c_setn",
        category: r"control",
        description: r"Set ranges of bus value(s).",
    },
    CommandEntry {
        address: r"/g_deepFree",
        category: r"group",
        description: r"Free all synths in this group and all its sub-groups.",
    },
    CommandEntry {
        address: r"/g_dumpTree",
        category: r"group",
        description: r"Post a representation of this group's node subtree.",
    },
    CommandEntry {
        address: r"/g_freeAll",
        category: r"group",
        description: r"Delete all nodes in a group.",
    },
    CommandEntry {
        address: r"/g_head",
        category: r"group",
        description: r"Add node to head of group.",
    },
    CommandEntry {
        address: r"/g_new",
        category: r"group",
        description: r"Create a new group.",
    },
    CommandEntry {
        address: r"/g_queryTree",
        category: r"group",
        description: r"Get a representation of this group's node subtree.",
    },
    CommandEntry {
        address: r"/g_tail",
        category: r"group",
        description: r"Add node to tail of group.",
    },
    CommandEntry {
        address: r"/p_new",
        category: r"group",
        description: r"Create a new parallel group.",
    },
    CommandEntry {
        address: r"/clearSched",
        category: r"master",
        description: r"Clear all scheduled bundles. Removes all bundles from the scheduling queue.",
    },
    CommandEntry {
        address: r"/cmd",
        category: r"master",
        description: r"Plug-in defined command.",
    },
    CommandEntry {
        address: r"/dumpOSC",
        category: r"master",
        description: r"Display incoming OSC messages.",
    },
    CommandEntry {
        address: r"/error",
        category: r"master",
        description: r"Enable/disable error message posting.",
    },
    CommandEntry {
        address: r"/notify",
        category: r"master",
        description: r"Register to receive notifications from server",
    },
    CommandEntry {
        address: r"/quit",
        category: r"master",
        description: r"Quit program. Exits the synthesis server.",
    },
    CommandEntry {
        address: r"/rtMemoryStatus",
        category: r"master",
        description: r"Queries the amount of currently free real-time memory (in bytes).",
    },
    CommandEntry {
        address: r"/status",
        category: r"master",
        description: r"Query the status. Replies to sender with the following message:",
    },
    CommandEntry {
        address: r"/sync",
        category: r"master",
        description: r"Notify when async commands have completed.",
    },
    CommandEntry {
        address: r"/version",
        category: r"master",
        description: r"Query the SuperCollider version. Replies to sender with the following message:",
    },
    CommandEntry {
        address: r"/n_after",
        category: r"node",
        description: r"Place a node after another.",
    },
    CommandEntry {
        address: r"/n_before",
        category: r"node",
        description: r"Place a node before another.",
    },
    CommandEntry {
        address: r"/n_fill",
        category: r"node",
        description: r"Fill ranges of a node's control value(s).",
    },
    CommandEntry {
        address: r"/n_free",
        category: r"node",
        description: r"Delete a node.",
    },
    CommandEntry {
        address: r"/n_map",
        category: r"node",
        description: r"Map a node's controls to read from a bus.",
    },
    CommandEntry {
        address: r"/n_mapa",
        category: r"node",
        description: r"Map a node's controls to read from an audio bus.",
    },
    CommandEntry {
        address: r"/n_mapan",
        category: r"node",
        description: r"Map a node's controls to read from audio buses.",
    },
    CommandEntry {
        address: r"/n_mapn",
        category: r"node",
        description: r"Map a node's controls to read from buses.",
    },
    CommandEntry {
        address: r"/n_order",
        category: r"node",
        description: r"Move and order a list of nodes.",
    },
    CommandEntry {
        address: r"/n_query",
        category: r"node",
        description: r"Get info about a node.",
    },
    CommandEntry {
        address: r"/n_run",
        category: r"node",
        description: r"Turn node on or off.",
    },
    CommandEntry {
        address: r"/n_set",
        category: r"node",
        description: r"Set a node's control value(s).",
    },
    CommandEntry {
        address: r"/n_setn",
        category: r"node",
        description: r"Set ranges of a node's control value(s).",
    },
    CommandEntry {
        address: r"/n_trace",
        category: r"node",
        description: r"Trace a node.",
    },
    CommandEntry {
        address: r"/nrt_end",
        category: r"nrt",
        description: r"End real time mode, close file. Not yet implemented. This message should be sent in a bundle in non real time mode. The bundle timestamp will establish the ending time of the file. This command will end non real time mode and close the sound file. Replies to sender with /done when complete.",
    },
    CommandEntry {
        address: r"/done",
        category: r"replies",
        description: r"An asynchronous message has completed.",
    },
    CommandEntry {
        address: r"/fail",
        category: r"replies",
        description: r"An error occurred.",
    },
    CommandEntry {
        address: r"/late",
        category: r"replies",
        description: r"A command was received too late. not yet implemented",
    },
    CommandEntry {
        address: r"/n_end",
        category: r"replies",
        description: r"A node ended. This command is sent to all registered clients when a node ends and is deallocated.",
    },
    CommandEntry {
        address: r"/n_go",
        category: r"replies",
        description: r"A node was started. This command is sent to all registered clients when a node is created.",
    },
    CommandEntry {
        address: r"/n_info",
        category: r"replies",
        description: r"Reply to /n_query. This command is sent to all registered clients in response to an /n_query command.",
    },
    CommandEntry {
        address: r"/n_move",
        category: r"replies",
        description: r"A node was moved. This command is sent to all registered clients when a node is moved.",
    },
    CommandEntry {
        address: r"/n_off",
        category: r"replies",
        description: r"A node was turned off. This command is sent to all registered clients when a node is turned off.",
    },
    CommandEntry {
        address: r"/n_on",
        category: r"replies",
        description: r"A node was turned on. This command is sent to all registered clients when a node is turned on.",
    },
    CommandEntry {
        address: r"/tr",
        category: r"replies",
        description: r"A trigger message.",
    },
    CommandEntry {
        address: r"/s_get",
        category: r"synth",
        description: r"Get control value(s).",
    },
    CommandEntry {
        address: r"/s_getn",
        category: r"synth",
        description: r"Get ranges of control value(s).",
    },
    CommandEntry {
        address: r"/s_new",
        category: r"synth",
        description: r"Create a new synth.",
    },
    CommandEntry {
        address: r"/s_noid",
        category: r"synth",
        description: r"Auto-reassign synth's ID to a reserved value.",
    },
    CommandEntry {
        address: r"/d_free",
        category: r"synthdef",
        description: r"Delete synth definition.",
    },
    CommandEntry {
        address: r"/d_load",
        category: r"synthdef",
        description: r"Load synth definition.",
    },
    CommandEntry {
        address: r"/d_loadDir",
        category: r"synthdef",
        description: r"Load a directory of synth definitions.",
    },
    CommandEntry {
        address: r"/d_recv",
        category: r"synthdef",
        description: r"Receive a synth definition file.",
    },
    CommandEntry {
        address: r"/u_cmd",
        category: r"unit",
        description: r"Send a command to a unit generator.",
    },
];
