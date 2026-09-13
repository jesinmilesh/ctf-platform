#include <stdio.h>
#include <string.h>
#include <stdlib.h>

// Expected Flag: XploitXβ{r3v3rs1ng_c_b1n4ry_3x3cu73}
static const unsigned char target[] = {
    0x08, 0x21, 0x3e, 0x3c, 0x3d, 0x21, 0x0e, 0x9e, 0xe3, 0x29,
    0x21, 0x67, 0x23, 0x65, 0x22, 0x22, 0x63, 0x3d, 0x33, 0x0a,
    0x35, 0x0f, 0x33, 0x63, 0x3d, 0x60, 0x27, 0x2f, 0x0f, 0x62,
    0x2a, 0x60, 0x37, 0x20, 0x61, 0x63, 0x2c
};

int check_flag(const unsigned char *input) {
    size_t len = strlen((const char *)input);
    if (len != 37) return 0;

    for (size_t i = 0; i < len; i++) {
        unsigned char transformed = input[i] ^ (unsigned char)(0x50 + (i % 7));
        if (transformed != target[i]) {
            return 0;
        }
    }
    return 1;
}

int main(int argc, char *argv[]) {
    if (argc < 2) {
        printf("=== XPLOITX LICENSING SUBSYSTEM ===\n");
        printf("Usage: %s <flag>\n", argv[0]);
        return 1;
    }

    if (check_flag((const unsigned char *)argv[1])) {
        printf("[+] KEY ACCEPTED: Access granted to tactical telemetry!\n");
    } else {
        printf("[-] ACCESS DENIED: Invalid license key.\n");
    }
    return 0;
}
