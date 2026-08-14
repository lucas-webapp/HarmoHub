#!/bin/bash
# Le serveur de test (python3 -m http.server) est mort en plein balayage lors d'une session
# précédente : toutes les suites suivantes ont alors échoué en cascade sur ERR_PROXY_CONNECTION_FAILED,
# ce qui ressemble à s'y méprendre à des bugs de l'appli. On le surveille donc et on le relance.
while true; do
  if ! curl -s -o /dev/null --max-time 4 http://localhost:8934/index.html; then
    echo "$(date +%H:%M:%S) serveur injoignable -> relance"
    (nohup python3 -m http.server 8934 >/dev/null 2>&1 &)
    sleep 3
  fi
  sleep 15
done
