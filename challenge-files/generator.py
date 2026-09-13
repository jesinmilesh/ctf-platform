#!/usr/bin/env python3
"""
XPLOITX // CYBER BATTLEFIELD
Mission: The Last Digit (OP-CRYPT-01)
Vulnerability: Broken LCG PRNG with known modulus
"""

import time

MODULUS = 2147483647  # 2^31 - 1 (Mersenne prime)
MULTIPLIER = 16807
INCREMENT = 0

class BrokenPRNG:
    def __init__(self, seed):
        self.state = seed

    def next(self):
        self.state = (MULTIPLIER * self.state + INCREMENT) % MODULUS
        return self.state

def generate_keystream(seed, length):
    prng = BrokenPRNG(seed)
    return [prng.next() & 0xFF for _ in range(length)]

if __name__ == "__main__":
    print("[+] XPLOITX LCG TELEMETRY GENERATOR")
    print(f"[+] Modulus: {MODULUS}, Multiplier: {MULTIPLIER}")
    # Flag: XploitXβ{l4st_d1g1t_lcg_br34k_9918}
