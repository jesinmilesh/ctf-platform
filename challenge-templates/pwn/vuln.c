#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <unistd.h>

void win() {
    printf("\n[+] ACCESS GRANTED! Hijacking instruction pointer...\n");
    FILE *f = fopen("/flag.txt", "r");
    if (!f) {
        printf("[-] Error opening flag file.\n");
        exit(1);
    }
    char buf[128];
    if (fgets(buf, sizeof(buf), f)) {
        printf("[FLAG]: %s\n", buf);
    }
    fclose(f);
    exit(0);
}

void vuln() {
    char buffer[64];
    printf("=== XPLOITX TELEMETRY INGESTION DAEMON ===\n");
    printf("Enter raw command payload: ");
    fflush(stdout);
    gets(buffer); // Vulnerable to stack buffer overflow
    printf("Processing: %s\n", buffer);
}

int main() {
    setvbuf(stdin, NULL, _IONBF, 0);
    setvbuf(stdout, NULL, _IONBF, 0);
    vuln();
    return 0;
}
