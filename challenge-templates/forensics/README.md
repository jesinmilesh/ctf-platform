# Forensics Challenge Template: Memory Artifact Infiltration

## Overview
A memory dump forensics challenge investigating a compromised terminal session.

## Scenario
An operative's workstation was seized during an intrusion event. Memory capture `memdump.raw` contains lingering process memory and environment variables containing classified tokens.

## Objectives
1. Identify the operating system profile using Volatility 3 (`python vol.py -f memdump.raw windows.info`).
2. Scan active process trees for suspicious shell spawning (`windows.pstree`).
3. Dump process memory of process ID 4812 (`windows.memmap --pid 4812 --dump`).
4. Search strings inside the memory dump for the flag prefix `XploitXβ{`.

## Flag
`XploitXβ{m3m0ry_4rt1f4c7_v0l4t1l1ty_extr4ct}`
