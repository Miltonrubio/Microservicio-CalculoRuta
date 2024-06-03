const express = require('express');

const app = express();
const port = 3000;
const axios = require('axios');



app.use(express.json());

const http = require('http');
const querystring = require('querystring');


app.get('/realizar-post', async (req, res) => {
  // Datos del formulario
  const postData = querystring.stringify({
    opcion: 2,
    id: 2
  });

  const options = {
    hostname: 'http://tallergeorgio.hopto.org/',
    port: 5611, // Puerto estándar para HTTP
    path: 'georgioapp/georgioapi/Controllers/Apiback.php',
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      'Content-Length': Buffer.byteLength(postData)
    }
  };

  const request = http.request(options, (response) => {
    let data = '';

    // Recibir datos de la respuesta
    response.on('data', (chunk) => {
      data += chunk;
    });

    // Al finalizar la respuesta
    response.on('end', () => {
      console.log('Respuesta:', data);
      res.send(data); // Enviar la respuesta de vuelta al cliente
    });
  });

  request.on('error', (e) => {
    console.error(`Problema con la solicitud: ${e.message}`);
    res.status(500).send('Error en la solicitud'); // Enviar error al cliente
  });

  // Escribir los datos del formulario en la solicitud
  request.write(postData);

  // Finalizar la solicitud
  request.end();
});


  /*
app.get('/crear', (req, res) => {
    const data = {
        opcion: "2"
    };

    console.log('Enviando datos a la API remota:', data);

    axios.post('http://192.168.16.113/apis/Controllers/Apiback.php', data)
        .then(response => {
            console.log('Respuesta del servidor remoto:', response.data); // Aquí accedemos a la data de la respuesta
            res.send(response.data); // Solo enviamos la data relevante al cliente
        })
        .catch(error => {
            console.error('Error realizando la petición:', error.message);
            if (error.response) {
                console.error('Error de la respuesta de la API:', error.response.data);
                res.status(error.response.status).send(error.response.data);
            } else if (error.request) {
                console.error('No se recibió respuesta de la API:', error.request);
                res.status(500).send('No se recibió respuesta de la API');
            } else {
                console.error('Error en la configuración de la petición:', error.message);
                res.status(500).send('Error en la configuración de la petición');
            }
        });
});
*/

app.listen(port, () => {
    console.log(`Servidor escuchando en http://localhost:${port}`);
});
