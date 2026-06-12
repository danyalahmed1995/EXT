#!/bin/bash

# Hello world script
echo "Hello, EXT user!"

greeting="Welcome to the shell script editor."
echo "$greeting"

for i in 1 2 3; do
  echo "Count: $i"
done

if [ -n "$USER" ]; then
  echo "Current user is: $USER"
fi
