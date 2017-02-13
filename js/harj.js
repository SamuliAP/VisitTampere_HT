$(function(){

  /* =======================================================================
   * -------- Vakiot ja globaalit muuttujat:
   */

  var AIKA = new Date().getTime(); // tämänhetkinen aika
  var url = "http://visittampere.fi:80/api/search?type=event&start_datetime="
             + AIKA +"&lang=fi&limit=10"; // JSON-tiedoston osoite
  var events = []; // taulukko, johon tallennetaan tapahtumatietueet
  

  /* =======================================================================
   * -------- Tapahtumien käsittely:
   */
   
  // jos tunnit tai minuutit ovat yksinumeroisia, metodi lisää nollan kyseisen luvun eteen
  function lisaaNolla(i){
    return (i<10) ? "0" + i : i;
  }


  // muuntaa ajan millisekunneista luettavaan muotoon (dd.mm.yyyy klo hh:mm)
  function muunnaAika(ms){
    if(ms!=null){
      var a = new Date(ms);
      return (a.getDate() + "." + (a.getMonth()+1) + "." + a.getFullYear()
              + " klo " + lisaaNolla(a.getHours()) + ":" + lisaaNolla(a.getMinutes())); 
    }
    else
      return("Aikaa ei annettu.");
  }
  
  function jarjesta(a, b){
    return (a.start_datetime-b.start_datetime);
  }
  // tuo halutun sisällön dokumenttiin
  function dokumenttiin(){

    // järjestetään tapahtumat aikataulun mukaan
    events.sort(jarjesta);

    for(var i = 0; i < events.length; i++){
      // luodaan nappi, jolla voidaan paikantaa tapahtuma kartalta
      var btnPaikanna = $('<button/>', {
        text: "Paikanna",
        class: "btn btn-primary pull-right",
        id: i,
        click: function(i){paikanna(this.id)}
      });
      
      // luodaan suosikkinappi
      var btnSuosikki = $('<button/>', {
        class: "btn btn-default pull-right",
        text: " Suosikki",
        id: i,
        click: function(i){suosikki(this.id)}
      });

      // luodaan linkki jolla siirrytään tapahtumasivulle
      var btnTapahtuma = $('<a/>', {
        class: "glyphicon glyphicon-open pull-right",
        text: " Tapahtumasivu",
        id: i,
        href: events[i].link,
        target: "_blank"
      });
      
      // luodaan suosikinpoistonappi suosikkilistaan
      var btnPoista = $('<button/>', {
        class: "btn btn-default pull-right",
        text: " Poista suosikki",
        id: i,
        click: function(i){suosikki(this.id); poistaSuosikki(this.id);}
      });

      var container = $('<div/>');

      // muunnetaan aika luettavaan muotoon
      events[i].start_datetime = muunnaAika(events[i].start_datetime);

      // tulostetaan tapahtuma html-dokumenttiin
      $('#dataLista').append(
        "<li id=" + "lista" + "><h3>" + events[i].title + "</h3><h5>| "
        + events[i].start_datetime + " | - " 
        + events[i].address + ":</h5>"
        + events[i].description
      );
      $("ul #lista").eq(i).append(container);
      $("ul #lista div").eq(i).append(btnSuosikki).append(btnPaikanna).append(btnTapahtuma);
        
      // ja suosikkilistaan
      $('.modal-body').append(
        "<li id=" + "lista" + "><h3>" + events[i].title + "</h3><h5>| "
        + events[i].start_datetime + " | - " 
        + events[i].address + ":</h5>"
        + events[i].description
      );
      $(".modal-body #lista").eq(i).append(btnPoista);

      // jos käytetään mobiililla, muutetaan tyyliasetuksia hiukan
      if( /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent) ) {
        $(".btn").addClass('btn-lg');
        $(".glyphicon").addClass('btn-lg');
        $("#dataLista").addClass('mobiili');
      }
    }
  }
  

  // asettaa halutut json-tiedoston tiedot events-taulukkoon
  tallenna = function(tieto){
    $("#btnHaku").button('loading');
    setTimeout(function () {
        $("#btnHaku").button('reset');
    }, 10000);
    events = [];
    setMapOnAll(null);
    markers = [];
    $("#dataLista").html("");
    $(".modal-body").html("");
    // käydään läpi kunnes tiedosto loppuu
    for(var i in tieto){
      if(tieto.hasOwnProperty(i)){ 
        // jos tapahtuma-aikoja on useita, etsitään lähin tuleva
        var osoite;
        var apuAik;
        var paras = AIKA*2;
        var loytyi = false;
        if(tieto[i].start_datetime == null){
          for(var x in tieto[i].times){
              apuAik = new Date(tieto[i].times[x].start_datetime);
              if(apuAik > AIKA && apuAik < paras){
                paras = apuAik;
                loytyi = true;
              }
          }
          if(loytyi)
            osoite = paras;
          else
            osoite = null;
        }
        else{
          osoite = new Date(tieto[i].start_datetime);
        }

        // tallennetaan tiedot
        events.push({
          title: tieto[i].title,
          start_datetime: osoite,
          address: tieto[i].contact_info.address,
          geocode: tieto[i].contact_info.address + ", " 
                   + tieto[i].contact_info.city,
          description: tieto[i].description,
          link: tieto[i].contact_info.link
        });
      }
    }
    // kun kaikki tapahtumat on saatu kirjattua,
    // käynnistetään kartta, suosikkilista ja dokumentin rakentaminen
    dokumenttiin();
    initSuosikit();
    initialize();
  }


  // metodi noutaa ja käsittelee .json-tiedoston
   function initJson(){
    var jsonObj;

    $.ajax({
      type: "GET",
      dataType: "json",
      url: url,
      data: "",
      success: function(jsonObj){
        tallenna(jsonObj);
      },
     error: function(){
     alert("Tiedon noutaminen ei onnistunut");
      }
    })
  }

   /* =======================================================================
   * -------- Suosikkien käsittely:
   */
 
  // dokumentin latauduttua asetetaan valintaruudut oikeisiin asentoihin
  function initSuosikit(){
    for(var i = 0; i <= events.length; i++){
      var avain = window.localStorage.getItem(i);
      // jos avain löytyy, valintaruutu valitaan
      if(avain !== null){
        $(".btn-default").eq(i).addClass('btn-success');
      }
    }
  }

  
  // valintaruutua klikatessa asetetaan muotoilut ja tallennetaan/poistetaan muistista
  function suosikki(indeksi){
    var mj = events[indeksi].title;

    if($(".btn-default").eq(indeksi).hasClass("btn-success")){
      $(".btn-default").eq(indeksi).removeClass('btn-success');
      localStorage.removeItem(indeksi)
    }
    else{
      $(".btn-default").eq(indeksi).addClass('btn-success');
      localStorage.setItem(indeksi, mj);
    }
  }


  // näytetään suosikit
  $("#suosikit").on('click', function(){
    for(var i = 0; i <= events.length; i++){
      var avain = window.localStorage.getItem(i);
      if(avain === null){
        $(".modal-body #lista").eq(i).addClass("hide");
        $(".modal-content .btn").eq(i).addClass("hide");  
      }
      else{
        $(".modal-body #lista").eq(i).removeClass("hide");
        $(".modal-body .btn").eq(i).removeClass("hide");
      }
    }
  })

  
  // poistetaan suosikki suosikkilistasta
  function poistaSuosikki(indeksi){
    for(var i = 0; i <= events.length; i++){
      var avain = window.localStorage.getItem(i);
      if(avain === null){
        $(".modal-body #lista").eq(i).addClass("hide");
        $(".modal-body .btn").eq(i).addClass("hide");
      }
    }
  }

  /* =======================================================================
   * -------- Kartan käsittely:
   */
   
  // kartan käsittelyyn käytettävät globaalit muuttujat:
  var map; // kartta
  var markers = []; // markereiden tiedot
  var infoWindow;
  function initialize() {
    
    var i=0;
    var GeocoderOptions;
    var geocoder;
    var nom;
    var temp;

    var mapOptions = {
      center: new google.maps.LatLng(61.497792, 23.761660),
      zoom: 11,
    };

    map = new google.maps.Map(document.getElementById("map"),
        mapOptions);

    infoWindow = new google.maps.Marker({map: map, title: "Olet tässä!"});

    geocoder = new google.maps.Geocoder();
    for(i=0;i<events.length;i++){
      
      GeocoderOptions={
         'address' : events[i].geocode,
         'region':'FI'
      };
        
      geocoder.geocode( GeocoderOptions, function(i){
        return function(results, status){
          if(status == google.maps.GeocoderStatus.OK){
            markers.push( new google.maps.Marker({
                position: results[0].geometry.location,
                map: map,
                title: events[i].title,
            })); 
          } else {
            alert('Geokoodaaminen epäonnistui seuraavista syistä: ' + status);
          }
        }
      }(i));
    }
  }
  
  // asettaa markereiden näkyvyyden
  function setMapOnAll(map) {
    for (var i = 0; i < markers.length; i++) {
      markers[i].setMap(map);
    }
  }
  
  // zoomataan ja keskitetään kartta, poistetaan kaikki markerit näkyvistä
  // ja tuodaan haluttu markeri näkyviin
  function paikanna(i){
    map.setZoom(13);
    map.setCenter(markers[i].getPosition());
    setMapOnAll(null);
    markers[i].title = events[i].title;
    markers[i].setMap(map);
  }

  // paikannetaan käyttäjän sijainti
  $("#omaSijainti").on('click', function(){
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(function(position) {
        var pos = {
        lat: position.coords.latitude,
        lng: position.coords.longitude
        };

        infoWindow.setPosition(pos);
        map.setZoom(13);
        map.setCenter(pos);
      }, function() {
      handleLocationError(true, infoWindow, map.getCenter());
    });
    } else {
      handleLocationError(false, infoWindow, map.getCenter());
    }
  })

  function handleLocationError(browserHasGeolocation, infoWindow, pos) {
    infoWindow.setPosition(pos);
    infoWindow.setContent(browserHasGeolocation ?
                        'Error: The Geolocation service failed.' :
                        'Error: Your browser doesn\'t support geolocation.');
  }

  /* =======================================================================
   * -------- Hakupalkki:
   */

  // oletuksena nykyinen päivämäärä
  $(window).load(function(){
    var nyky = new Date();
    $("#pv").attr('value', nyky.getDate());
    $("#kk").attr('value', nyky.getMonth() + 1);
    $("#vuosi").attr('value', nyky.getFullYear());
    initJson();
  })

  // kategoria dropdownin teksti vaihtuu valittuun kategoriaan
  $("ul li a").on('click', function(){
    $("#droppi").text($(this).text());
  })

  // suoritetaan uusi json-haku, jolle annetaan päivitetty osoite
  $("#btnHaku").on('click', function(){
    var pv = $('#pv').val();
    var kk = $('#kk').val() - 1;
    var vuosi = $('#vuosi').val();
    var haluttu = new Date(vuosi, kk, pv).getTime();
    var kategoria = $("#droppi").text();
    var tuloksetKpl = annaTulos();

    function annaTulos() {
      var tulos;
      for(var i = 0; i < 3; i++){
        if($("#kpl label").eq(i).hasClass('active'))
          tulos = i;
      }
      if(tulos == 0){
        return "3";
      }
      else if(tulos == 1){
        return "5";
      }
      else if(tulos == 2){
        return "10";
      }
    }

    AIKA = haluttu;

    // tarkastetaan, annettiinko kategoriaa
    if(kategoria != "Kategoria"){
     url = "http://visittampere.fi:80/api/search?type=event&tag=" 
            + kategoria +"&start_datetime="
            + haluttu +"&lang=fi&limit=" + tuloksetKpl;
    }
     else{
      url = "http://visittampere.fi:80/api/search?type=event&start_datetime="
            + haluttu +"&lang=fi&limit=" + tuloksetKpl;
     }
    initJson();
  })

  /* =======================================================================
   * -------- Kommenttikenttä:
   */

  var myDataRef = new Firebase('https://blazing-inferno-8354.firebaseio.com/');
  $('#viesti').keypress(function(e){
    if(e.keyCode == 13){
      var name = $('#kayttaja').val();
      var text = $('#viesti').val();
      myDataRef.push({name: name, text: text});
      $('#viesti').val("");
    }
  });

  myDataRef.on('child_added', function(snapshot) {
    var message = snapshot.val();
    naytaViesti(message.name, message.text);
  });

  function naytaViesti(name, text){
    $('<div/>').text(text).prepend($('<b/>').text(name + ': ')).appendTo($('#viestitDiv'));
    $('#viestitDiv')[0].scrollTop = $('#viestitDiv')[0].scrollHeight;
  };
})
