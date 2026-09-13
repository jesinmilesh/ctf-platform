# Fermat Factorization RSA Challenge
import math

FLAG = b"XploitXβ{f3rm47_f4c70r1z4710n_34sy_m47h}"

# Example parameters:
# Two close 256-bit primes
p = 104523984180424564887754605908253160868202976766779836938228308472504933907727
q = 104523984180424564887754605908253160868202976766779836938228308472504933907939

n = p * q
e = 65537
phi = (p - 1) * (q - 1)
d = pow(e, -1, phi)

m = int.from_bytes(FLAG, 'big')
c = pow(m, e, n)

if __name__ == "__main__":
    print(f"n = {n}")
    print(f"e = {e}")
    print(f"c = {c}")
