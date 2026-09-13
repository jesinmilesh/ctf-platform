# Crypto Challenge Template: Fermat's Ghost

## Overview
An asymmetric RSA cryptography challenge where primes $p$ and $q$ are selected dangerously close together ($|p - q| < 250$).

## Vulnerability
Because $|p - q|$ is very small, Fermat's factorization method quickly finds:
$$n = a^2 - b^2 = (a - b)(a + b) = p \cdot q$$
where $a \approx \lceil\sqrt{n}\rceil$.

## Running Solution
```bash
python solution.py
```

## Flag
`XploitXβ{f3rm47_f4c70r1z4710n_34sy_m47h}`
