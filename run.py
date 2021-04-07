import sys
import subprocess
args = sys.argv[1:]

if len(args) != 1:
    print("Usage: \nIf running locally: python run.py local\nIf uploading to teensy: python run.py teensy")

else:
    if args[0] == "teensy":
        subprocess.run(["pio", "run", "-e", "teensy36", "-t", "upload"])
        subprocess.run(["pio", "device", "monitor"])
    else:
        subprocess.run(["pio", "run", "-e", "native"])
        subprocess.run([".pio/build/native/program"])