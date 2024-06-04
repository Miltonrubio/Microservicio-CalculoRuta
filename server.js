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

  socket.on('disconnect', () => {
    clientesConectados--;
    if (clientesConectados === 0 && intervalo) {
      clearInterval(intervalo);
      intervalo = null;
    }
    console.log('Cliente desconectado');
  });

  socket.on('buscar:puntoCercano', (coordenadas) => {
    const { latitud, longitud } = coordenadas;
    const puntoCercano = buscarPuntoMasCercano(latitud, longitud);
    if (puntoCercano) {
      if (historialUbicaciones.length > 0) {
        const vehiculoPosicion = historialUbicaciones[historialUbicaciones.length - 1];
        const indiceVehiculo = buscarIndicePuntoMasCercano(vehiculoPosicion.latitude, vehiculoPosicion.longitude);
        const indicePuntoCercano = buscarIndicePuntoMasCercano(latitud, longitud);

        if (indiceVehiculo !== -1 && indicePuntoCercano !== -1 && indiceVehiculo < indicePuntoCercano) {
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
          socket.emit('resultado:puntoCercano', { puntoCercano, distancia: null, tiempoEstimado: null });
        }
      } else {
        socket.emit('resultado:puntoCercano', { puntoCercano, distancia: null, tiempoEstimado: null });
      }
    } else {
      socket.emit('error', 'No se encontró un punto cercano en la ruta.');
    }
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
  let indiceMasCercano = -1;
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


/*
function calcularDistanciaYTiempoHastaFinal(vehiculoPosicion) {
  let distanciaTotal = 0;
  let tiempoTotal = 0;

  // Calcular la distancia y el tiempo hasta el siguiente punto en la ruta
  if (puntosRestantes.length > 0) {
    const siguientePunto = {
      latitude: parseFloat(puntosRestantes[0].latitud),
      longitude: parseFloat(puntosRestantes[0].longitud)
    };
    const distanciaAlSiguientePunto = geolib.getDistance(vehiculoPosicion, siguientePunto);
    const velocidadVehiculo = 10 * 1000 / 3600; // Suponiendo una velocidad promedio de 10 km/h
    const tiempoAlSiguientePunto = distanciaAlSiguientePunto / velocidadVehiculo;

    distanciaTotal += distanciaAlSiguientePunto;
    tiempoTotal += tiempoAlSiguientePunto;

    // Calcular la distancia y el tiempo para los puntos restantes en la ruta
    for (let i = 1; i < puntosRestantes.length; i++) {
      const puntoActual = {
        latitude: parseFloat(puntosRestantes[i - 1].latitud),
        longitude: parseFloat(puntosRestantes[i - 1].longitud)
      };
      const puntoSiguiente = {
        latitude: parseFloat(puntosRestantes[i].latitud),
        longitude: parseFloat(puntosRestantes[i].longitud)
      };
      const distancia = geolib.getDistance(puntoActual, puntoSiguiente);
      const tiempo = distancia / velocidadVehiculo;

      distanciaTotal += distancia;
      tiempoTotal += tiempo;
    }

    io.sockets.emit("ubi:distanciaTotal", distanciaTotal);
    io.sockets.emit("ubi:tiempoTotal", tiempoTotal);
  } else {
    console.error("No hay puntos restantes en la ruta.");
  }
}
*/




function tomarRuta2(datos) {
  axios.get(`http://192.168.16.114:3000/api/route/${datos}`)
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

