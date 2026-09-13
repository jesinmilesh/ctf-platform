# Fermat Factorization Solution Script
import math

n = 10925263268949644699622272062696689917159989518499179866634518559311632900192916798895533607717950818256531473969686903271927258032879640373631504538744653
e = 65537
c = 1135711818991960323031677886903638904080939869102050333242076147345730785024587002563156258773269169649615883166634856326730025944565899364040169580726124

def is_square(n):
    root = math.isqrt(n)
    return root * root == n

def fermat(n):
    a = math.isqrt(n)
    if a * a < n:
        a += 1
    while True:
        b2 = a * a - n
        if is_square(b2):
            b = math.isqrt(b2)
            p = a - b
            q = a + b
            return p, q
        a += 1

p, q = fermat(n)
phi = (p - 1) * (q - 1)
d = pow(e, -1, phi)
m = pow(c, d, n)
flag = m.to_bytes((m.bit_length() + 7) // 8, 'big').decode('utf-8')
print("[+] Recovered Flag:", flag)
