---
name: grill-me
description: Interview a half-formed idea, plan, or decision in dependency-ordered rounds until it is ready to commit, then close with a pre-mortem that turns failure modes into binary pass/fail criteria. Use when someone asks to think something through, poke holes in a plan, or stress-test it before building. Do not use for reviewing finished work, writing the plan itself, or a decision already made.
license: MIT
compatibility: Standalone. Needs no repository, no MCP server, and no particular project layout. Writes one checkpoint file to a location the user chooses, and keeps the checkpoint in the conversation where no writable location exists.
allowed-tools: Read Write Glob Grep
metadata:
  author: Keith Crawford
  version: 1.1.0
  source: https://github.com/tsudo/skills/tree/main/skills/grill-me
---

# grill-me

Interrogate a half-formed idea until its shape is clear enough to commit to.

## When To Use

- An idea, plan, or decision is real enough to discuss but too vague to build.
- A plan is about to be built and nobody has stated what would make it fail.
- Someone asks to have their thinking stress-tested rather than summarized.

Do not use this to review finished work, to write the plan itself, or where the decision is already made and only needs recording.

## Definitions

Use these terms exactly. Do not substitute synonyms.

- **design tree** - the decision structure for the topic. Every decision branches into the decisions that depend on it.
- **frontier** - every decision whose prerequisites are already settled. These are the questions answerable now without guessing at answers not yet heard.
- **round** - one batch of frontier questions, asked together and answered together.
- **checkpoint** - the Markdown file recording settled decisions, the question log, and open flags.
- **pre-mortem** - the closing pass that imagines the idea shipped and failed.
- **criterion** - one binary pass/fail statement produced by the pre-mortem.

## Procedure

### Step 1 - Establish the topic

If the invocation includes a topic, use it. If it is bare, ask what to grill, then continue.

### Step 2 - Create the checkpoint

Derive a slug from the topic: lowercase, hyphen-separated, at most four words. Ask where the checkpoint should go. If the user does not care, write `grill-{slug}.md` to the working directory. If the project has an obvious home for working notes such as an existing `docs/`, `notes/`, or `scratch/` directory, offer that instead. State the chosen path before continuing. Ask before overwriting an existing file.

Create the checkpoint with four headings: `## Shape & Settled Decisions`, `## Question Log`, `## Open Flags`, and `## Criteria`.

If the runtime has no writable project or file output surface, keep the checkpoint in the conversation. Maintain the same four headings and update discipline, and return the full checkpoint Markdown whenever the run stops: at a round boundary, at the twelve-question limit, or at the close. Say once, up front, that the checkpoint lives in the conversation and the user should keep a copy. Nothing else about the interview changes.

### Step 3 - Run the shape check

If the category of the topic is ambiguous, propose two or three candidate shapes and ask discriminating questions until one shape survives. If the category is already obvious, skip this step.

### Step 4 - Build the design tree

Identify the decisions the topic depends on and order them by dependency. A decision whose answer depends on an unsettled decision is not on the frontier.

### Step 5 - Find facts before asking

Finding facts is your job, never the user's. If a frontier question needs a fact from code or files, use Glob, Grep, or Read to find it. Ask the user only when the environment cannot answer, or when the answer is a preference. Read files directly rather than dispatching subagents.

### Step 6 - Ask the round

Compute the frontier and ask every frontier question in one round. Format each question as:

```text
**Q1 - <question title>**

<question body, including the real alternatives>

**Recommended:** <the answer you would pick, and why in one line>
```

Lead with a recommendation on every question. If a recommendation is low-confidence or the decision is high-stakes, add the single strongest objection below it. If exactly one question is blocking and its answer space is bounded, use a structured multiple-choice prompt when available, with the recommendation first. Wait for answers. Do not proceed to the next round unprompted.

### Step 7 - Checkpoint the round

Append each question and answer to `## Question Log`. Promote settled decisions to `## Shape & Settled Decisions`. Record anything needing external input under `## Open Flags`. Write the checkpoint before asking the next round. If it lives in the conversation, restate it there instead.

### Step 8 - Recompute and repeat

Each answer settles a decision and pushes the frontier outward. Recompute the frontier and return to Step 6.

### Step 9 - Stop

Stop when any one of these is true:

- The frontier is empty. Every branch is visited and nothing is silently assumed.
- Twelve questions have been asked. Surface the checkpoint and ask whether to continue.
- Two consecutive answers are low-signal (for example, "I don't know" or "skip"). Record both under `## Open Flags` and stop.

### Step 10 - Run the pre-mortem

Ask the user to imagine the idea shipped and failed: what went wrong? Convert each failure mode into one binary, testable pass/fail criterion and write the criteria under `## Criteria`.

### Step 11 - Hand off

Name what should happen next and stop. Do not do it.

| The grilled shape needs | Say so and stop |
| --- | --- |
| A written design or decision record | The shape and criteria are the input to it |
| Issue or ticket tracking | The settled decisions are the scope |
| Implementation | The criteria are the acceptance tests |
| More thinking, not more structure | The open flags are what is still missing |

Do not act on the grilled plan until the user confirms you understood it the same way they do.

## Output

One checkpoint at the agreed path, containing the settled shape, full question log, open flags, and pre-mortem criteria. Where the runtime has no writable location, return the same checkpoint in the conversation.

No other file is created or modified.

## What This Skill Does NOT Do

- Does not write code, specifications, design documents, or tickets.
- Does not edit existing files. Only the checkpoint is written.
- Does not carry out the next step it names.
- Does not proceed past a round without an answer.
- Does not structure thinking the user has already done. It finds out what the thinking is, which comes before that.
- Does not look backward at finished work. It looks forward at work not yet started.

## Gotchas

- A session with no disagreement means the skill was not needed. If the user accepts every recommendation without pushback, say the idea was already clear and stop early rather than manufacturing rounds.
- Some questions cannot be grilled. A question such as "How should this feel?" needs a prototype. Record it under `## Open Flags` instead of asking it.
- Batched rounds fail when the tree is shallow. If the frontier holds one question for three rounds running, ask it directly and finish.

`grill-me` by Keith Crawford, from [github.com/tsudo/skills](https://github.com/tsudo/skills). Copyright (c) 2026 Keith Crawford. SPDX-License-Identifier: MIT. See the source repository for the full license text.
