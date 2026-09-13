FROM ubuntu:22.04

RUN apt-get update && apt-get install -y gcc-multilib socat make && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY vuln.c Makefile ./
COPY flag.txt /flag.txt

RUN make && chmod 444 /flag.txt && chmod 755 /app/vuln

EXPOSE 1337

CMD ["socat", "-T60", "TCP-LISTEN:1337,reuseaddr,fork", "EXEC:/app/vuln"]
