# Web Challenge Template: Quantum Vault

## Overview
A web authentication challenge demonstrating improper debugging disclosure and authentication bypass.

## Vulnerability
Visiting `/api/status?debug=1` leaks the hardcoded internal admin token: `super_classified_quantum_token`.
Submitting username `admin` and password `super_classified_quantum_token` to `/login` yields the flag.

## Flag
`XploitXβ{w3b_qu4n7um_v4ul7_pwn3d}`

## Deploying
```bash
docker build -t xploitx-web-vault .
docker run -d -p 41000:80 xploitx-web-vault
```
