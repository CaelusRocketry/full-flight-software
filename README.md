# Flight Software

New flight software for our projects, written in C++.

## First-time setup

First, clone the repository, and move into the directory where it was cloned. Then, install PlatformIO by running

```pip install pio```

After that's done, download the PlatformIO IDE extension in VS Code.

If you don't already have it, download the MinGW C++ compiler from [here](https://https://sourceforge.net/projects/mingw-w64/).

Run

```pio --version```

to make sure that PlatformIO was set up correctly.

## Running locally

To run locally, make sure you're in the cpp-flight-software folder, and run

```python run.py local```

## Uploading to a Teensy 3.6

To upload and run the flight software on a Teensy 3.6, make sure you're in the cpp-flight-software folder, and run

```python run.py teensy```
