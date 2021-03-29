//
// Created by AC on 4/24/2020.
//

#ifndef FLIGHT_ERRORS_HPP
#define FLIGHT_ERRORS_HPP

#include <exception>

enum class Error {
    // no error
    NONE
};

class DYNAMIC_CAST_ERROR : public std::exception {
    virtual const char* what() const throw()
    {
        return "Dynamic casting doesn't work";
    }
};

class PACKET_ARGUMENT_ERROR : public std::exception {
    virtual const char* what() const throw()
    {
        return "Invalid packet: number of arguments for the function specified in the GS packet doesn't match the number of arguments in the FS function definition.";
    }
};

class INVALID_HEADER_ERROR : public std::exception {
    virtual const char* what() const throw()
    {
        return "Invalid packet: GS packet header doesn't match any of the valid packet headers.";
    }
};

class INVALID_SOLENOID_ERROR : public std::exception {
    virtual const char* what() const throw()
    {
        return "Unable to find an actuatable solenoid.";
    }
};

class BAD_COMMAND_PIN_ERROR : public std::exception {
    virtual const char* what() const throw()
    {
        return "Incorrect command format to actuate a solenoid: bad pin number";
    }
};

class INVALID_PACKET_MESSAGE_ERROR : public std::exception {
    virtual const char* what() const throw()
    {
        return "Invalid GS packet message.";
    }
};

class INVALID_SENSOR_LOCATION_ERROR : public std::exception {
    virtual const char* what() const throw()
    {
        return "Invalid GS packet message: cannot find the specified sensor.";
    }
};

class INVALID_VALVE_LOCATION_ERROR : public std::exception {
    virtual const char* what() const throw()
    {
        return "Invalid GS packet message: cannot find the specified valve.";
    }
};

class SOCKET_READ_ERROR : public std::exception {
    virtual const char* what() const throw()
    {
        return "An unexpected error occurred while reading from the socket.";
    }
};

class SOCKET_WRITE_ERROR : public std::exception {
    virtual const char* what() const throw()
    {
        return "An unexpected error occurred while writing to the socket.";
    }
};

class SOCKET_CONNECTION_ERROR : public std::exception {
    virtual const char* what() const throw()
    {
        return "Socket connection failed.";
    }
};

class XBEE_READ_ERROR : public std::exception {
    virtual const char* what() const throw()
    {
        return "An unexpected error occurred while reading from the socket.";
    }
};

class XBEE_WRITE_ERROR : public std::exception {
    virtual const char* what() const throw()
    {
        return "An unexpected error occurred while writing to the socket.";
    }
};

class XBEE_CONNECTION_ERROR : public std::exception {
    virtual const char* what() const throw()
    {
        return "Socket connection failed.";
    }
};

class JSON_ARGUMENT_ERROR : public std::exception {
    virtual const char* what() const throw()
    {
        return "No arguments to parse json";
    }
};

class INVALID_STAGE : public std::exception {
    virtual const char* what() const throw()
    {
        return "Unknown stage.";
    }
};

class INVALID_PACKET_ARGUMENTS_ERROR : public std::exception {
    virtual const char* what() const throw()
    {
        return "Invalid packet arguments, unable to ingest.";
    }
};

#endif //FLIGHT_ERRORS_HPP
