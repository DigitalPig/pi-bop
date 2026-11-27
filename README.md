# pi-bop

A small shared pet for Pi. The cat chases a ball of unraveling yarn, the axolotl chases a worm, and the panda runs toward bamboo in a widget above the editor. Bop eats food from your submitted chat messages and sleeps after five minutes of inactivity. Running agent work keeps Bop awake. Bop does not become hungry while Pi is closed and cannot die. Scenes loop around the track and are hidden in reduced-motion and very narrow terminal modes.

```text
  /\_/\
 ( o.o )
 ( > < )~
  U   U
```

## Installation

Requires Pi with a runtime that supports `node:sqlite`. Install the GitHub package globally from your terminal:

```bash
pi install git:github.com/DigitalPig/pi-bop
```

Start Pi or run `/reload` in an existing session. To install only for the current project instead, add `--local`:

```bash
pi install --local git:github.com/DigitalPig/pi-bop
```

Pi project-local packages load only in trusted projects. To update or remove the package:

```bash
pi update git:github.com/DigitalPig/pi-bop
pi remove git:github.com/DigitalPig/pi-bop
```

If you already installed a local copy of pi-bop, remove that source with `pi remove /path/to/pi-bop` before installing the GitHub copy, to avoid loading it twice. The shared pet state is stored separately and is not removed with the package.

## Commands

- `/bop` — show fullness, total meals, age, and whether Bop is awake.
- `/bop hide` and `/bop show` — hide/show the widget in this window.
- `/bop motion off` and `/bop motion on` — disable/enable animation in this window.
- `/bop inventory` — list available species and mini Bops.
- `/bop species cat`, `/bop species axolotl`, or `/bop species panda` — change Bop's appearance, keeping its identity and progress.
- `/bop breed` — hatch a mini Bop once Bop is an adult (maximum three).

One interactive chat message adds one food item, up to five pending: `*` for the cat, a small `Y` bamboo shoot for the panda, and a short `~~` worm for the axolotl. The axolotl also chases a longer `~~~~~` worm along the ground. Slash commands, extension messages, assistant messages and tool results do not create food. Bop still eats while hidden or with motion disabled. Visibility and motion reset when the extension reloads.

## Growth and mini Bops

Bop grows from baby to young at 5 meals, then adult at 15. Growth is based on food actually collected, not messages sent. Once adult, `/bop breed` hatches a mini instantly; this first version uses solo hatching rather than requiring a partner. Each mini keeps the species Bop had when it hatched and follows in the same four-row widget. Minis are decorative companions for now: they do not eat, grow, or breed independently. Cat, axolotl, and panda are built-in appearances in the inventory, not separately managed pets.

## Resource use

The widget redraws at up to eight frames per second only while visible, awake, and moving. Sleeping, hidden, reduced-motion and very narrow terminal modes have no animation loop. An awake Pi window refreshes a small shared presence record every 20 seconds; local filesystem notifications update other windows without polling. Food and condition are saved on meaningful events, not per animation frame. There is no GPU work, model call, network access, or background daemon. A queued pellet is collected with a one-shot timer when animation is off.

## Shared state

All local Pi sessions for the same OS user share `~/.pi/agent/pi-bop/state.sqlite`. SQLite transactions protect updates and ensure each pellet is eaten at most once. Per-window animation positions are not shared. Presence records expire if Pi crashes. If the save is unreadable or incompatible, Bop reports an error and preserves the database rather than resetting it. pi-bop never stores chat contents or raw keystrokes. The state directory is private to the user when created.

Version 1 saves are migrated on the first update; Bop's identity, feeding history, condition and pending food are preserved. Reload all Pi windows when upgrading: old extension instances cannot read version 2 saves, but will not overwrite them.

To try a local checkout without installing, use `pi --no-extensions -e /path/to/pi-bop/index.ts`. Run the tests from the checkout with `npm test` on a recent Node.js version supporting TypeScript stripping and `node:sqlite`.

## Future ideas

Individual mini-pet growth, two-parent breeding, accessories, and a richer inventory could build on the current shared save.
