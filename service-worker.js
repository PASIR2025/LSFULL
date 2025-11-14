const  CACHE_NAME  =  'logicsoft-cache-v1' ;
constante  ACTIVOS  =  [
  './' ,
  './index.html' ,
  './manifest.json'
  // Nota: tus iconos ya existentes se cachearán bajo demanda,
  // o puedes listarlos aquí si conoces sus nombres exactos.
] ;

self.addEventListener ( 'install ' , ( event ) = > {   
  evento . esperarHasta (
    cachés.abrir ( NOMBRE_CACHÉ ) .entonces ( caché = > caché.agregarTodos ( ACTIVOS ) )​​​​  
  ) ;
  self.skipWaiting ( ) ;​​
} ) ;

self.addEventListener ( ' activate ' , ( event ) = > {   
  evento . esperarHasta (
    caches.keys ( ) . then ( keys = > Promise.all ( keys.map ( k = > k ! == CACHE_NAME ? caches.delete ( k ) : null ) ) )​​​​​      
  ) ;
  auto.clientes.reclamar ( ) ;​​​​
} ) ;

self.addEventListener ( ' fetch ' , ( event ) = > {   
  const  req  =  event.request ;​​
  // Estrategia: cache-first para GET, passthrough para otras
  if  ( req . method  !==  'GET' )  return ;
  evento . responderCon (
    cachés.coincide ( req ) .entonces ( cached = > {​​  
      Si  ( en caché )  devolver  en caché ;
      return  fetch ( req ) .then ( res = > {  
        const  copia  =  res.clone ( ) ;​​
        cachés.open ( NOMBRE_CACHÉ ) .then ( caché = > caché.put ( req , copia ) ) ;​​​​   
        devolver  res ;
      } ) .catch ( ( ) = > cached || Response.error ( ) ) ;​​    
    } )
  ) ;
} ) ;