CC = gcc
CFLAGS = -O2 -s -fno-stack-protector

all: license_check

license_check: main.c
	$(CC) $(CFLAGS) main.c -o license_check

clean:
	rm -f license_check
