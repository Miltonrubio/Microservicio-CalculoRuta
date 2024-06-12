const express = require('express');
const http = require('http');
const cors = require("cors");
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



let ipApi = '192.168.16.113'

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


let solicitudesClientes = [];

const numeroRuta = 39;


// Inicializar rutas
tomarRuta2(numeroRuta);
tomarRuta(numeroRuta);

/*
io.on('connection', (socket) => {
  console.log('Nuevo cliente conectado');
  clientesConectados++;

  if (!intervalo) {
    TomarYEnviarUbicaciones();
    intervalo = setInterval(TomarYEnviarUbicaciones, 3000);
  }

  socket.on('disconnect', () => {
    clientesConectados--;
    if (clientesConectados === 0 && intervalo) {
      clearInterval(intervalo);
      intervalo = null;
    }
    console.log('Cliente desconectado');
  });

  //Socket que calcula la el punto mas cercano al click que dio el cliente 
  socket.on('buscar:puntoCercano', (coordenadas) => {
    const { latitud, longitud } = coordenadas;
    const puntoCercano = buscarPuntoMasCercano(latitud, longitud);

    if (puntoCercano) {
      if (historialUbicaciones.length > 0) {
        const vehiculoPosicion = historialUbicaciones[historialUbicaciones.length - 1];
        const indiceVehiculo = buscarIndicePuntoMasCercano(vehiculoPosicion.latitude, vehiculoPosicion.longitude);
        const indicePuntoCercano = buscarIndicePuntoMasCercano(latitud, longitud);

        if (indiceVehiculo !== -1 && indicePuntoCercano !== -1) {
          if (indiceVehiculo < indicePuntoCercano) {
            let distanciaTotal = 0;
            for (let i = indiceVehiculo; i < indicePuntoCercano; i++) {
              distanciaTotal += geolib.getDistance(
                { latitude: parseFloat(puntosRestantes[i].latitud), longitude: parseFloat(puntosRestantes[i].longitud) },
                { latitude: parseFloat(puntosRestantes[i + 1].latitud), longitude: parseFloat(puntosRestantes[i + 1].longitud) }
              );
            }

            const velocidadVehiculo = 10 * 1000 / 3600; // Convertir 10 km/h a m/s
            const tiempoEstimado = distanciaTotal / velocidadVehiculo; // Tiempo en segundos
            socket.emit('resultado:puntoCercano', { puntoCercano, distancia: distanciaTotal, tiempoEstimado });
          } else {
            socket.emit('resultado:puntoCercano', { puntoCercano, mensaje: 'El vehículo ya ha pasado por este punto.', distancia: null, tiempoEstimado: null });
          }
        } else {
          socket.emit('resultado:puntoCercano', { puntoCercano, mensaje: 'No se pudo encontrar la ubicación del vehículo o del punto cercano.', distancia: null, tiempoEstimado: null });
        }
      } else {
        socket.emit('resultado:puntoCercano', { puntoCercano, mensaje: 'No hay historial de ubicaciones disponibles.', distancia: null, tiempoEstimado: null });
      }
    } else {
      socket.emit('error', 'No se encontró un punto cercano en la ruta.');
    }
  });

});
*/


/*

io.on('connection', (socket) => {
  console.log('Nuevo cliente conectado');
  clientesConectados++;

  if (!intervalo) {
    TomarYEnviarUbicaciones();
    intervalo = setInterval(TomarYEnviarUbicaciones, 3000);
  }

  socket.on('disconnect', () => {
    clientesConectados--;
    if (clientesConectados === 0 && intervalo) {
      clearInterval(intervalo);
      intervalo = null;
    }
    console.log('Cliente desconectado');
  });

  // Socket que calcula el punto más cercano al clic que dio el cliente 
  socket.on('buscar:puntoCercano', (coordenadas) => {
    solicitudesClientes.push({ socketId: socket.id, coordenadas });
    recalcularDistanciaYTiempo(socket.id, coordenadas);
  });
});

*/

io.on('connection', (socket) => {
  console.log('Nuevo cliente conectado');
  clientesConectados++;

  if (!intervalo) {
    TomarYEnviarUbicaciones();
    intervalo = setInterval(TomarYEnviarUbicaciones, 3000);
  }

  socket.on('disconnect', () => {
    clientesConectados--;
    if (clientesConectados === 0 && intervalo) {
      clearInterval(intervalo);
      intervalo = null;
    }
    console.log('Cliente desconectado');
    delete solicitudesClientes[socket.id];
  });

  // Socket que calcula el punto más cercano al clic que dio el cliente 
  socket.on('buscar:puntoCercano', (data) => {
    const { requestId, latitud, longitud } = data;
    solicitudesClientes[socket.id] = { requestId, latitud, longitud };
    recalcularDistanciaYTiempo(socket.id, requestId, latitud, longitud);
  });
});


function recalcularDistanciaYTiempo(socketId, requestId, latitud, longitud) {
  const puntoCercano = buscarPuntoMasCercano(latitud, longitud);

  if (puntoCercano) {
    if (historialUbicaciones.length > 0) {
      const vehiculoPosicion = historialUbicaciones[historialUbicaciones.length - 1];
      const indiceVehiculo = buscarIndicePuntoMasCercano(vehiculoPosicion.latitude, vehiculoPosicion.longitude);
      const indicePuntoCercano = buscarIndicePuntoMasCercano(latitud, longitud);

      if (indiceVehiculo !== -1 && indicePuntoCercano !== -1) {
        if (indiceVehiculo < indicePuntoCercano) {
          let distanciaTotal = 0;
          for (let i = indiceVehiculo; i < indicePuntoCercano; i++) {
            distanciaTotal += geolib.getDistance(
              { latitude: parseFloat(puntosRestantes[i].latitud), longitude: parseFloat(puntosRestantes[i].longitud) },
              { latitude: parseFloat(puntosRestantes[i + 1].latitud), longitude: parseFloat(puntosRestantes[i + 1].longitud) }
            );
          }

          const velocidadVehiculo = 10 * 1000 / 3600; // Convertir 10 km/h a m/s
          const tiempoEstimado = distanciaTotal / velocidadVehiculo; // Tiempo en segundos
          io.to(socketId).emit('resultado:puntoCercano', { requestId, puntoCercano, distancia: distanciaTotal, tiempoEstimado });
        } else {
          io.to(socketId).emit('resultado:puntoCercano', { requestId, puntoCercano, mensaje: 'El vehículo ya ha pasado por este punto.', distancia: null, tiempoEstimado: null });
        }
      } else {
        io.to(socketId).emit('resultado:puntoCercano', { requestId, puntoCercano, mensaje: 'No se pudo encontrar la ubicación del vehículo o del punto cercano.', distancia: null, tiempoEstimado: null });
      }
    } else {
      io.to(socketId).emit('resultado:puntoCercano', { requestId, puntoCercano, mensaje: 'No hay historial de ubicaciones disponibles.', distancia: null, tiempoEstimado: null });
    }
  } else {
    io.to(socketId).emit('error', 'No se encontró un punto cercano en la ruta.');
  }
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

        historialUbicaciones.push(vehiculoPosicion);
        io.sockets.emit("ubi:vehiculo", vehiculoPosicion);
        io.sockets.emit("ubi:historialUbicaciones", historialUbicaciones);

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

        const postData = {
          routeId: numeroRuta,
          pointId: puntoMasCercano.punto_id
        };
        axios.post('http://192.168.1.88:3000/api/geofence/next', postData)
          .then(response => {
            console.log('Respuesta del servidor:', response.data);
            io.sockets.emit("geocerca:actual", response.data);
          })
          .catch(error => {
            console.error('Error en la solicitud POST:', error);
          });

        let distanciaAlSiguientePunto = null;
        if (puntoMasCercano) {
          const indicePuntoMasCercano = puntosRestantes.findIndex(punto => punto.punto_id === puntoMasCercano.punto_id);
          if (indicePuntoMasCercano >= 0 && indicePuntoMasCercano < puntosRestantes.length - 1) {
            const siguientePunto = {
              latitude: parseFloat(puntosRestantes[indicePuntoMasCercano + 1].latitud),
              longitude: parseFloat(puntosRestantes[indicePuntoMasCercano + 1].longitud)
            };

            distanciaAlSiguientePunto = geolib.getDistance(vehiculoPosicion, siguientePunto);
            io.sockets.emit("ubi:distanciaSiguientePunto", distanciaAlSiguientePunto);

            const velocidadVehiculo = 10 * 1000 / 3600; // Convertir 10 km/h a m/s
            const tiempoEstimado = distanciaAlSiguientePunto / velocidadVehiculo; // Tiempo en segundos

            io.sockets.emit("ubi:tiempoEstimado", tiempoEstimado);
          } else {
            console.error("No hay un siguiente punto en la ruta.");
          }
        }

        puntosRestantes = puntosRestantes.filter((punto, index) => {
          const puntoPosicion = {
            latitude: parseFloat(punto.latitud),
            longitude: parseFloat(punto.longitud),
          };
          const distancia = geolib.getDistance(vehiculoPosicion, puntoPosicion);

          if (distancia <= 16) {
            if (!historialPuntos.has(punto.punto_id)) {
              historialPuntos.set(punto.punto_id, 0);
            }
            historialPuntos.set(punto.punto_id, historialPuntos.get(punto.punto_id) + 1);

            if (historialPuntos.get(punto.punto_id) === 1) {
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
*/



function TomarYEnviarUbicaciones() {
  TomarUbicacionesPorRatos()
    .then(ubicacionVehiculo => {
      if (ubicacionVehiculo && ubicacionVehiculo.length > 0) {
        const vehiculoPosicion = {
          latitude: parseFloat(ubicacionVehiculo[0].latitude),
          longitude: parseFloat(ubicacionVehiculo[0].longitude)
        };

        historialUbicaciones.push(vehiculoPosicion);
        io.sockets.emit("ubi:vehiculo", vehiculoPosicion);
        io.sockets.emit("ubi:historialUbicaciones", historialUbicaciones);

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

        const postData = {
          routeId: numeroRuta,
          pointId: puntoMasCercano.punto_id
        };
        axios.post(`http://${ipApi}:3000/api/geofence/next`, postData)
          .then(response => {
            console.log('Respuesta del servidor:', response.data);
            io.sockets.emit("geocerca:actual", response.data);
          })
          .catch(error => {
            console.error('Error en la solicitud POST:', error);
          });

        let distanciaAlSiguientePunto = null;
        if (puntoMasCercano) {
          const indicePuntoMasCercano = puntosRestantes.findIndex(punto => punto.punto_id === puntoMasCercano.punto_id);
          if (indicePuntoMasCercano >= 0 && indicePuntoMasCercano < puntosRestantes.length - 1) {
            const siguientePunto = {
              latitude: parseFloat(puntosRestantes[indicePuntoMasCercano + 1].latitud),
              longitude: parseFloat(puntosRestantes[indicePuntoMasCercano + 1].longitud)
            };

            distanciaAlSiguientePunto = geolib.getDistance(vehiculoPosicion, siguientePunto);
            io.sockets.emit("ubi:distanciaSiguientePunto", distanciaAlSiguientePunto);

            const velocidadVehiculo = 10 * 1000 / 3600; // Convertir 10 km/h a m/s
            const tiempoEstimado = distanciaAlSiguientePunto / velocidadVehiculo; // Tiempo en segundos

            io.sockets.emit("ubi:tiempoEstimado", tiempoEstimado);
          } else {
            console.error("No hay un siguiente punto en la ruta.");
          }
        }

        puntosRestantes = puntosRestantes.filter((punto, index) => {
          const puntoPosicion = {
            latitude: parseFloat(punto.latitud),
            longitude: parseFloat(punto.longitud),
          };
          const distancia = geolib.getDistance(vehiculoPosicion, puntoPosicion);

          if (distancia <= 16) {
            if (!historialPuntos.has(punto.punto_id)) {
              historialPuntos.set(punto.punto_id, 0);
            }
            historialPuntos.set(punto.punto_id, historialPuntos.get(punto.punto_id) + 1);

            if (historialPuntos.get(punto.punto_id) === 1) {
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

        // Recalcular y emitir distancia y tiempo estimado para cada cliente
        for (const [socketId, solicitud] of Object.entries(solicitudesClientes)) {
          recalcularDistanciaYTiempo(socketId, solicitud.requestId, solicitud.latitud, solicitud.longitud);
        }

      } else {
        console.error("No se encontraron ubicaciones de vehículos.");
      }
    })
    .catch(error => {
      console.error("Error al tomar los mensajes de la base de datos:", error);
    });
}

function buscarPuntoMasCercano(latitud, longitud) {
  let puntoMasCercano = null;
  let distanciaMinima = Infinity;

  puntosRestantes.forEach(punto => {
    const puntoPosicion = {
      latitude: parseFloat(punto.latitud),
      longitude: parseFloat(punto.longitud)
    };
    const distancia = geolib.getDistance({ latitude: latitud, longitude: longitud }, puntoPosicion);

    if (distancia < distanciaMinima) {
      distanciaMinima = distancia;
      puntoMasCercano = punto;
    }
  });

  return puntoMasCercano;
}



function buscarIndicePuntoMasCercano(latitud, longitud) {
  let indiceMasCercano = -2;
  let distanciaMinima = Infinity;

  puntosRestantes.forEach((punto, index) => {
    const puntoPosicion = {
      latitude: parseFloat(punto.latitud),
      longitude: parseFloat(punto.longitud)
    };
    const distancia = geolib.getDistance({ latitude: latitud, longitude: longitud }, puntoPosicion);

    if (distancia < distanciaMinima) {
      distanciaMinima = distancia;
      indiceMasCercano = index;
    }
  });

  return indiceMasCercano;
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
  axios.get(`http://${ipApi}:3000/api/route/${datos}`)
    .then(response => {
      rutaCompleta = response.data.points;
      puntosRestantes = [...rutaCompleta];
    })
    .catch(error => {
      console.error('Error al hacer la petición:', error);
    });
}




//Se usa un socket para mostrar la ruta en otro archivo ignoralo jeje
function tomarRuta2(datos) {
  axios.get(`http://${ipApi}:3000/api/route/${datos}`)
    .then(response => {
      rutaCompleta2 = response.data.points;
    })
    .catch(error => {
      console.error('Error al hacer la petición:', error);
    });
}

const PORT = process.env.PORT || 3000;
httpServer.listen(PORT, () => {
  console.log(`Servidor escuchando en el puerto ${PORT}`);
});
