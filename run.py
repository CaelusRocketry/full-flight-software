import subprocess
subprocess.run(["pio", "run", "-e", "native"])
subprocess.run([".pio/build/native/program"])