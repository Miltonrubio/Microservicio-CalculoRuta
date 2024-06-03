const express = require('express');
const http = require('http');
const cors = require("cors");
const socketIo = require('socket.io');
const { Server } = require("socket.io");
const axios = require('axios');
const geolib = require('geolib');

const connection = require("./bdconfig");
const app = express();
app.use(express.static('public/'));
app.use(express.json());

const httpServer = http.createServer(app);
const io = new Server(httpServer, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"],
    credentials: true
  }
});

let ultimoId = '0';
let clientesConectados = 0;
let rutaCompleta2 = [];

let puntosRecorridos = [];
let rutaCompleta = [];
let puntosRestantes = [];
let puntosNoRecorridos = [];
let historialPuntos = new Map();
let historialUbicaciones = [];
let intervalo;

tomarRuta2("8");

tomarRuta("9");

io.on('connection', (socket) => {
  console.log('Nuevo cliente conectado');
  clientesConectados++;

  if (!intervalo) {
    TomarYEnviarUbicaciones();
    intervalo = setInterval(TomarYEnviarUbicaciones, 3000);
  }

  socket.on('mensaje', (data) => {
    console.log(`Mensaje recibido: ${data}`);
    io.emit('mensaje', data);
  });

  socket.on('disconnect', () => {
    clientesConectados--;
    if (clientesConectados === 0 && intervalo) {
      clearInterval(intervalo);
      intervalo = null;
    }
    console.log('Cliente desconectado');
  });
});

function TomarYEnviarUbicaciones() {
  TomarUbicacionesPorRatos()
    .then(ubicacionVehiculo => {
      if (ubicacionVehiculo && ubicacionVehiculo.length > 0) {
        const vehiculoPosicion = {
          latitude: parseFloat(ubicacionVehiculo[0].latitude),
          longitude: parseFloat(ubicacionVehiculo[0].longitude)
        };

        console.log("Vehículo posición:", vehiculoPosicion);

        historialUbicaciones.push(vehiculoPosicion);
        io.sockets.emit("ubi:vehiculo", vehiculoPosicion);
        io.sockets.emit("ubi:historialUbicaciones", historialUbicaciones);

        // Encontrar el punto más cercano en la ruta a la posición actual del vehículo
        let puntoMasCercano = null;
        let distanciaMinima = Infinity;

        puntosRestantes.forEach(punto => {
          const puntoPosicion = {
            latitude: parseFloat(punto.latitud),
            longitude: parseFloat(punto.longitud)
          };
          const distancia = geolib.getDistance(vehiculoPosicion, puntoPosicion);

          if (distancia < distanciaMinima) {
            distanciaMinima = distancia;
            puntoMasCercano = punto;
          }
        });

        console.log("Punto más cercano:", puntoMasCercano);
        console.log("Distancia al punto más cercano:", distanciaMinima);

        // Calcular la distancia al siguiente punto en la ruta
        let distanciaAlSiguientePunto = null;
        if (puntoMasCercano) {
          const indicePuntoMasCercano = puntosRestantes.indexOf(puntoMasCercano);
          if (indicePuntoMasCercano >= 0 && indicePuntoMasCercano < puntosRestantes.length - 1) {
            const siguientePunto = {
              latitude: parseFloat(puntosRestantes[indicePuntoMasCercano + 1].latitud),
              longitude: parseFloat(puntosRestantes[indicePuntoMasCercano + 1].longitud)
            };

            distanciaAlSiguientePunto = geolib.getDistance(vehiculoPosicion, siguientePunto);
            io.sockets.emit("ubi:distanciaSiguientePunto", distanciaAlSiguientePunto);
            console.log("Distancia al siguiente punto:", distanciaAlSiguientePunto);

            // Calcular el tiempo estimado de llegada
            const velocidadVehiculo = 10 * 1000 / 3600; // Convertir 10 km/h a m/s
            const tiempoEstimado = distanciaAlSiguientePunto / velocidadVehiculo; // Tiempo en segundos

            io.sockets.emit("ubi:tiempoEstimado", tiempoEstimado);
            console.log("Tiempo estimado al siguiente punto (segundos):", tiempoEstimado);
          } else {
            console.error("No hay un siguiente punto en la ruta.");
          }
        }

        puntosRestantes = puntosRestantes.filter((punto, index) => {
          const puntoPosicion = {
            latitude: parseFloat(punto.latitud),
            longitude: parseFloat(punto.longitud)
          };
          const distancia = geolib.getDistance(vehiculoPosicion, puntoPosicion);

          if (distancia <= 16) {
            const puntoClave = `${punto.latitud},${punto.longitud}`;
            if (!historialPuntos.has(puntoClave)) {
              historialPuntos.set(puntoClave, 0);
            }
            historialPuntos.set(puntoClave, historialPuntos.get(puntoClave) + 1);

            if (historialPuntos.get(puntoClave) === 1) {
              puntosRecorridos.push(punto);
              return false; 
            }
          }
          return true; 
        });

        io.sockets.emit("ubi:rutaCompleta2", rutaCompleta2);
        io.sockets.emit("ubi:puntosRecorridos", puntosRecorridos);
        io.sockets.emit("ubi:puntosRestantes", puntosRestantes);
        io.sockets.emit("ubi:puntosNoRecorridos", puntosNoRecorridos);
      } else {
        console.error("No se encontraron ubicaciones de vehículos.");
      }
    })
    .catch(error => {
      console.error("Error al tomar los mensajes de la base de datos:", error);
    });
}

function TomarUbicacionesPorRatos() {
  return new Promise((resolve, reject) => {
    const query = "SELECT * FROM ubicaciones ORDER BY ID DESC limit 1";
    connection.query(query, (error, results) => {
      if (error) {
        console.error("Error al ejecutar la consulta:", error);
        reject(error);
      } else {
        resolve(results);
      }
    });
  });
}

function tomarRuta(datos) {
  axios.get(`http://192.168.16.114:3000/api/route/${datos}`)
    .then(response => {
      rutaCompleta = response.data.points;
      puntosRestantes = [...rutaCompleta];
      console.log("Ruta completa obtenida:", rutaCompleta);
      console.log("Puntos de la ruta:", puntosRestantes);
    })
    .catch(error => {
      console.error('Error al hacer la petición:', error);
    });
}

function tomarRuta2(datos) {
  axios.get(`http://192.168.16.114:3000/api/route/${datos}`)
    .then(response => {
      rutaCompleta2 = response.data.points;
    })
    .catch(error => {
      console.error('Error al hacer la petición:', error);
    });
}


/*

function TomarYEnviarUbicaciones() {
  TomarUbicacionesPorRatos()
    .then(ubicacionVehiculo => {
      if (ubicacionVehiculo && ubicacionVehiculo.length > 0) {
        const vehiculoPosicion = {
          latitude: parseFloat(ubicacionVehiculo[0].latitude),
          longitude: parseFloat(ubicacionVehiculo[0].longitude)
        };

        console.log("Vehículo posición:", vehiculoPosicion); // Depuración

        historialUbicaciones.push(vehiculoPosicion); // Guardar la ubicación en el historial

        io.sockets.emit("ubi:vehiculo", vehiculoPosicion);
        io.sockets.emit("ubi:historialUbicaciones", historialUbicaciones); // Enviar el historial de ubicaciones
        console.log("Posición del vehículo:", vehiculoPosicion);

        let distanciaAlSiguientePunto = null;
        if (puntosRestantes.length > 0) {
          const siguientePunto = {
            latitude: parseFloat(puntosRestantes[0].latitud),
            longitude: parseFloat(puntosRestantes[0].longitud)
          };

          console.log("Siguiente punto:", siguientePunto); // Depuración

          if (!isNaN(siguientePunto.latitude) && !isNaN(siguientePunto.longitude)) {
            distanciaAlSiguientePunto = geolib.getDistance(vehiculoPosicion, siguientePunto);
            io.sockets.emit("ubi:distanciaSiguientePunto", distanciaAlSiguientePunto);
            console.log("Distancia al siguiente punto:", distanciaAlSiguientePunto);
          } else {
            console.error("Coordenadas del siguiente punto no válidas:", siguientePunto);
          }
        } else {
          console.error("No hay puntos restantes en la ruta.");
        }

        puntosRestantes = puntosRestantes.filter((punto, index) => {
          const puntoPosicion = {
            latitude: parseFloat(punto.latitud),
            longitude: parseFloat(punto.longitud)
          };
          const distancia = geolib.getDistance(vehiculoPosicion, puntoPosicion);
         // console.log("Distancia al punto:", distancia);

          if (distancia <= 16) {
            const puntoClave = `${punto.latitud},${punto.longitud}`;
            if (!historialPuntos.has(puntoClave)) {
              historialPuntos.set(puntoClave, 0);
            }
            historialPuntos.set(puntoClave, historialPuntos.get(puntoClave) + 1);

            if (historialPuntos.get(puntoClave) === 1) { // Si ha pasado por el punto por primera vez
              puntosRecorridos.push(punto);
              return false; // Eliminar este punto de puntosRestantes
            }
          }
          return true; // Mantener este punto en puntosRestantes
        });
        io.sockets.emit("ubi:rutaCompleta2", rutaCompleta2);
        
        io.sockets.emit("ubi:puntosRecorridos", puntosRecorridos);
        io.sockets.emit("ubi:puntosRestantes", puntosRestantes);
        io.sockets.emit("ubi:puntosNoRecorridos", puntosNoRecorridos);
      } else {
        console.error("No se encontraron ubicaciones de vehículos.");
      }
    })
    .catch(error => {
      console.error("Error al tomar los mensajes de la base de datos:", error);
    });
}
*/


function TomarUbicacionesPorRatos() {
  return new Promise((resolve, reject) => {
    const query = "SELECT * FROM ubicaciones ORDER BY ID DESC limit 1";
    connection.query(query, (error, results) => {
      if (error) {
        console.error("Error al ejecutar la consulta:", error);
        reject(error);
      } else {
        resolve(results);
      }
    });
  });
}

function tomarRuta(datos) {
  axios.get(`http://192.168.16.114:3000/api/route/${datos}`)
    .then(response => {
      rutaCompleta = response.data.points;
      puntosRestantes = [...rutaCompleta];
      console.log("Ruta completa obtenida:", rutaCompleta);
      // Depurar los puntos de la ruta
      console.log("Puntos de la ruta:", puntosRestantes);
    })
    .catch(error => {
      console.error('Error al hacer la petición:', error);
    });
}

function tomarRuta2(datos) {
  axios.get(`http://192.168.16.114:3000/api/route/${datos}`)
    .then(response => {
      rutaCompleta2 = response.data.points;
      
    })
    .catch(error => {
      console.error('Error al hacer la petición:', error);
    });
}


/*

function TomarUbicacionesPorRatos() {
  return new Promise((resolve, reject) => {
    const url = 'http://192.168.16.250:8000/ubirecolector/';
    const datos = {
      opcion: '1',
      fecha: new Date().toISOString().split('T')[0],
      idunidad: '2',
      ultimoid: ultimoId,
      token: '614bed1bd61f096015dbd903d8628312'
    };

    console.log("Enviando solicitud a la API con los datos:", datos);

    axios.post(url, datos, {
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      }
    })
      .then(response => {
        const datos = response.data;
        
        resolve(datos);
      })
      .catch(error => {

        console.error("Error al ejecutar la consulta:", error);
        reject(error);
      });
  });
}
*/




/*

let rutaCompleta = [];
let puntosRecorridos = [];
let puntosRestantes = [];





iniciarSeguimiento();


// Inicializar seguimiento una vez que la ruta esté cargada


//TomarYEnviarUbicaciones();
//intervalo = setInterval(TomarYEnviarUbicaciones, 3000);

function iniciarSeguimiento() {
  tomarRuta("9")
  .then(() => {
    TomarYEnviarUbicaciones();
    intervalo = setInterval(TomarYEnviarUbicaciones, 3000);
  }).catch(error => {
    console.error('Error inicializando la ruta y el seguimiento:', error);
  });
}



io.on('connection', (socket) => {
  console.log('Nuevo cliente conectado');
  clientesConectados++;

  socket.on('mensaje', (data) => {
    console.log(`Mensaje recibido: ${data}`);
    io.emit('mensaje', data);
  });

  socket.on('disconnect', () => {
    clientesConectados--;
    if (clientesConectados === 0) {
      clearInterval(intervalo);
      intervalo = null;
    }
    console.log('Cliente desconectado');
  });
});




function TomarYEnviarUbicaciones() {
  TomarUbicacionesPorRatos()
    .then(ubicacionVehiculo => {
      if (ubicacionVehiculo && ubicacionVehiculo.length > 0) {
        const vehiculoPosicion = {
          latitude: parseFloat(ubicacionVehiculo[0].latitude),
          longitude: parseFloat(ubicacionVehiculo[0].longitude)
        };

        io.sockets.emit("ubi:vehiculo", vehiculoPosicion);
        console.log("Posición del vehículo:", vehiculoPosicion);

        puntosRestantes = puntosRestantes.filter(punto => {
          const puntoPosicion = {
            latitude: parseFloat(punto.latitude),
            longitude: parseFloat(punto.longitude)
          };
          const distancia = geolib.getDistance(vehiculoPosicion, puntoPosicion);
          //  console.log("Distancia al punto:", distancia);

          if (distancia <= 20) {
            puntosRecorridos.push(punto);
            console.log("Punto añadido a puntosRecorridos:", punto);
            return false; // Eliminar este punto de puntosRestantes
          }
          return true; // Mantener este punto en puntosRestantes
        });

        console.log("Puntos recorridos:", puntosRecorridos);
        console.log("Puntos restantes:", puntosRestantes);

        // Emitir los puntos recorridos
        io.sockets.emit("ubi:puntosRecorridos", puntosRecorridos);

        // Emitir los puntos restantes
        io.sockets.emit("ubi:puntosRestantes", puntosRestantes);
      } else {
        console.error("No se encontraron ubicaciones de vehículos.");
      }
    })
    .catch(error => {
      console.error("Error al tomar los mensajes de la base de datos:", error);
    });
}

/*
function TomarYEnviarUbicaciones() {
  TomarUbicacionesPorRatos()
    .then(ubicacionVehiculo => {
      if (ubicacionVehiculo && ubicacionVehiculo.length > 0) {
      //  console.log("Datos: " + JSON.stringify(ubicacionVehiculo));

        const vehiculoPosicion = {
          latitude: parseFloat(ubicacionVehiculo[0].latitude),
          longitude: parseFloat(ubicacionVehiculo[0].longitude)
        };

        // Emitir la ubicación del vehículo
        io.sockets.emit('ubi:vehiculo', vehiculoPosicion);
        console.log(ubicacionVehiculo);

        puntosRestantes = puntosRestantes.filter(punto => {
          const puntoPosicion = {
            latitude: parseFloat(punto.latitude),
            longitude: parseFloat(punto.longitude)
          };
          const distancia = geolib.getDistance(vehiculoPosicion, puntoPosicion);
          if (distancia <= 20) {
            puntosRecorridos.push(punto);
            return false; // Eliminar este punto de puntosRestantes
          }
          return true; // Mantener este punto en puntosRestantes
        });

        // Emitir los puntos recorridos
        io.sockets.emit("ubi:puntosRecorridos", puntosRecorridos);

        // Emitir los puntos restantes
        io.sockets.emit("ubi:puntosRestantes", puntosRestantes);
      //  console.log("Ruta Pendiente " + puntosRestantes)

      } else {
        console.error("No se encontraron ubicaciones de vehículos.");
      }
    })
    .catch(error => {
      console.error("Error al tomar los mensajes de la base de datos:", error);
    });
}



/*

function TomarYEnviarUbicaciones() {
  TomarUbicacionesPorRatos()
    .then(ubicacionVehiculo => {
      io.sockets.emit("ubi:show", ubicacionVehiculo);
      console.log("Datos: " + JSON.stringify(ubicacionVehiculo));

    })
    .catch(error => {
      console.error("Error al tomar los mensajes de la base de datos:", error);
    });
}

/*
function TomarUbicacionesPorRatos() {
  return new Promise((resolve, reject) => {
    const url = 'http://192.168.16.250:8000/ubirecolector/';
    const datos = {
      opcion: '1',
      fecha: new Date().toISOString().split('T')[0],
      idunidad: '2',
      ultimoid: ultimoId,
      token: '614bed1bd61f096015dbd903d8628312'
    };

    console.log("Enviando solicitud a la API con los datos:", datos);

    axios.post(url, datos, {
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      }
    })
      .then(response => {
        const datos = response.data;
        console.log(" Respuesta api: " + datos)

        if (Array.isArray(datos) && datos.length > 0) {
          const elementoMayorId = datos.reduce((max, item) => (item.idubi > max.idubi ? item : max), datos[0]);
          ultimoId = elementoMayorId.idubi - 1;
          resolve(elementoMayorId);
        } else {
          reject(new Error("La respuesta de la API no contiene datos válidos"));

          console.log("La respuesta de la API no contiene datos válidos");
        }
      })
      .catch(error => {
        console.error("Error al ejecutar la solicitud:", error.message);

        if (error.response) {
          console.error("Detalles del error:", error.response.data);
        }
        reject(error);
      });
  });
}
*/
/*

function TomarUbicacionesPorRatos() {
  return new Promise((resolve, reject) => {
    const query = "SELECT * FROM ubicaciones ORDER BY ID DESC limit 1";
    connection.query(query, (error, results) => {
      if (error) {
        console.error("Error al ejecutar la consulta:", error);
        reject(error);
      } else {
        resolve(results);
      }
    });
  });
}

/*

function tomarRuta(datos) {
  axios.get(`http://192.168.16.114:3000/api/route/${datos}`)
    .then(response => {
      rutaCompleta = response.data.points;
      puntosRestantes = [...rutaCompleta]; // Inicialmente, todos los puntos están en puntosRestantes
      console.log("Ruta completa obtenida:", rutaCompleta);
    })
    .catch(error => {
      console.error('Error al hacer la petición:', error);
    });
}
*/

/*
function tomarRuta(datos) {
  return new Promise((resolve, reject) => {
    axios.get(`http://192.168.16.114:3000/api/route/${datos}`)
      .then(response => {
        rutaCompleta = response.data.points;
        puntosRestantes = [...rutaCompleta];
        console.log("Ruta completa obtenida:", rutaCompleta);
        resolve(); // Aseguramos de resolver la promesa aquí
      })
      .catch(error => {
        console.error('Error al hacer la petición:', error);
        reject(error); // Y aquí, rechazar la promesa
      });
  });
}


/*
function tomarRuta(datos) {

  axios.get(`http://192.168.16.114:3000/api/route/${datos}`,)
    .then(response => {
      console.log(response.data);

      const points = response.data.points;

      // Enviar los datos a todos los clientes conectados
      io.emit('pointsData', points);
    })
    .catch(error => {
      console.error('Error al hacer la petición:', error);
    });
}
*/

const PORT = process.env.PORT || 3000;
httpServer.listen(PORT, () => {
  console.log(`Servidor escuchando en el puerto ${PORT}`);
});


/*

function TomarYEnviarUbicaciones() {
    TomarUbicacionesPorRatos()
        .then(ubicacionVehiculo => {
            io.sockets.emit("ubi:show", ubicacionVehiculo);
        })
        .catch(error => {
            console.error("Error al tomar los mensajes de la base de datos:", error);
        });
}

  function TomarUbicacionesPorRatos() {
    return new Promise((resolve, reject) => {
      const url = 'http://192.168.16.250:8000/ubirecolector/';
      const datos = {
        opcion: '1',
        fecha: '2024-05-28',
        idunidad: '2',
        ultimoid: '29002',
        token: '614bed1bd61f096015dbd903d8628312'
      };
  
      console.log("Enviando solicitud a la API con los datos:", datos);
  
      axios.post(url, datos, {
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        }
      })
      .then(response => {
        const datos = response.data;
        if (Array.isArray(datos) && datos.length > 0) {
          const elementoMayorId = datos.reduce((max, item) => (item.idubi > max.idubi ? item : max), datos[0]);
          console.log("Obtuviste respuesta:" + elementoMayorId)
          resolve(elementoMayorId);
        } else {
          reject(new Error("La respuesta de la API no contiene datos válidos"));
        }
      })
      .catch(error => {
        console.error("Error al ejecutar la solicitud:", error.message);
        if (error.response) {
          console.error("Detalles del error:", error.response.data);
        }
        reject(error);
      });
    });
  }
*/



