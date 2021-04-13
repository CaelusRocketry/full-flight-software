import json
# The JSON file used will depend on the current test
json_data = json.load(open("config.json"))
json_str = json.dumps(json_data)
json_str = json_str.replace('"', '\\"')
# print(json_str)

create_var = "#define CONFIG_STR \"" + json_str + "\""

to_write = "#ifndef CONSTANTS_HPP\n#define CONSTANTS_HPP\n\n" + create_var + "\n\n#endif"

file = open("include/flight/modules/lib/Constants.hpp", "w+")
file.write(to_write)
file.close()
