# Forensics Solution: Memory Artifact Infiltration

### Step 1: Memory Inspection
```bash
vol -f memdump.raw windows.pslist
```
Identify PID 4812 (`cmd.exe`) spawned by an untrusted PowerShell script.

### Step 2: Environment Strings Extraction
```bash
vol -f memdump.raw windows.envars --pid 4812
```
Alternatively, extract ASCII and UTF-16 strings:
```bash
strings -e l memdump.raw | grep "XploitXβ{"
```

### Result
`XploitXβ{m3m0ry_4rt1f4c7_v0l4t1l1ty_extr4ct}`
