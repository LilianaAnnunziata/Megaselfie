//Funzioni con un particolare scopo
angular.module('app.controllers', ['ngCordova', 'omr.directives', 'ionic', 'ion-gallery', 'angular-svg-round-progressbar'])

  .controller('homeCtrl', ['$scope', '$localStorage', '$firebaseStorage', 'shareData', 'GeoAlert', 'databaseMegaselfie', '$state','$ionicListDelegate','$ionicPopup',
    function ($scope, $localStorage, $firebaseStorage, shareData, GeoAlert, databaseMegaselfie, $state,$ionicListDelegate,$ionicPopup) {

      $scope.sortType = 'timestamp'; // set the default sort type
      $scope.sortReverse = false;
      // Ordinamento
      $scope.change = function (type, reverse) {
        $scope.sortReverse = !reverse;
        $scope.sortType = type;
      };

      //cancellazione
      $scope.delItem = function(event) {
        var confirmPopup = $ionicPopup.confirm({
            title: 'Do you want to unsubscribe from the event "' + event.title + '"?',
          });

        confirmPopup.then(function(res) {
          if(res) {
            $scope.eventList.splice($scope.eventList.indexOf(event), 1);
            $ionicListDelegate.closeOptionButtons();
            databaseMegaselfie.deleteEvent(event.eventID,event.role);
          }
        });
      };


      if (navigator.geolocation) {
        navigator.geolocation.getCurrentPosition(storePosition);
      } else {
        $ionicPopup.alert({
          title: 'Error',
          template: 'Activate the GPS sensor.'
        });
      }

      function storePosition(position) {
        $localStorage.lat = position.coords.latitude;
        $localStorage.long = position.coords.longitude;
        GeoAlert.begin();
      }


      $scope.goTo = function (info) {
        var objectEvent = JSON.parse(info);
        shareData.setData(objectEvent);
        //if(objectEvent.startDate)
        $state.go("eventInfo");
        //else
        //$state.go("gallery");
      };

      var query = window.database.ref('users/' + $localStorage.uid);
      $scope.eventList = [];
      query.once("value", function (snapshot) {
        //iterazione su tutti gli eventi dell'utente
        snapshot.forEach(function (childSnapshot) {
          // recupero nome dell'evento
          var eventKey = childSnapshot.key;
          //console.log(eventKey)
          //creazione obj da inserire nella lista
          var obj = {};
          //recupero ruolo da users
          obj.role = childSnapshot.val().role;

          //accedo al nodo events, nel database
          var eventRef = window.database.ref('events/' + eventKey);
          //accedo a campi dell'evento
          eventRef.once("value", function (snapshot) {

            var eventObj = snapshot.val();

            var start = eventObj.start ? eventObj.start.split(" ") : undefined;
            var end = eventObj.end.split(" ");
            var endDateSplit = end[0].split("/");
            var endTimeSplit = end[1].split(":");

            var timestamp = new Date(endDateSplit[2],endDateSplit[1]-1,endDateSplit[0],endTimeSplit[0],endTimeSplit[1]).getTime();

            obj.eventID = eventKey;
            obj.title = eventObj.title;
            obj.description = eventObj.description;
            obj.createdBy = eventObj.createdBy;
            if (start) {
              obj.startDate = start[0];
              obj.startTime = start[1];
            }
            obj.endDate = end[0];
            obj.endTime = end[1];
            obj.timestamp = timestamp;
            obj.closed = eventObj.closed;
            var eventStorageRef = window.storage.ref(eventKey + "/" + "icon.png");
            var storageFire = $firebaseStorage(eventStorageRef);
            storageFire.$getDownloadURL().then(function (imgSrc) {
              obj.src = imgSrc;
              $scope.eventList.push(obj);
            });
          });
        });
      });
    }])


  .controller('createLiveEventCtrl', ['$scope', '$stateParams', 'dateFilter', '$localStorage', '$state', 'databaseMegaselfie', '$cordovaGeolocation', 'shareData', '$ionicPopup',
    function ($scope, $stateParams, dateFilter, $localStorage, $state, databaseMegaselfie, $cordovaGeolocation, shareData, $ionicPopup) {

      var options = {timeout: 10000, enableHighAccuracy: true};
      $scope.liveEvent = {};
      $scope.liveEvent.range = 100;
      $scope.isDisabled = true;

      $cordovaGeolocation.getCurrentPosition(options).then(function (position) {

        var latLng = $scope.latLng = new google.maps.LatLng(position.coords.latitude, position.coords.longitude);

        var mapOptions = {
          center: latLng,
          zoom: 17,
          mapTypeId: google.maps.MapTypeId.ROADMAP
        };

        $scope.map = new google.maps.Map(document.getElementById("map"), mapOptions);
        $scope.circle = new google.maps.Circle({
          strokeColor: '#FF0000',
          strokeOpacity: 0.8,
          strokeWeight: 2,
          fillColor: '#FF0000',
          fillOpacity: 0.35,
          map: $scope.map,
          center: $scope.latLng,
          radius: 100
        });

      }, function (error) {
        $ionicPopup.alert({
          title: 'Error',
          template: 'Activate the GPS sensor.'
        });

      });

      $scope.slideChange = function (liveEvent) {
        var range = parseInt(liveEvent.range);
        if ($scope.circle)
          $scope.circle.setMap(null);
        $scope.circle = new google.maps.Circle({
          strokeColor: '#FF0000',
          strokeOpacity: 0.8,
          strokeWeight: 2,
          fillColor: '#FF0000',
          fillOpacity: 0.35,
          map: $scope.map,
          center: $scope.latLng,
          radius: range
        });
      };

      $scope.startLiveEvent = function (liveEvent) {

        navigator.geolocation.getCurrentPosition(function (position) {
          var lat = position.coords.latitude,
            lng = position.coords.longitude,
            today = new Date();

          var objToSend = {
            createdBy: $localStorage.profileData.name,
            title: liveEvent.name,
            end: dateFilter(today, "dd/MM/yyyy HH:mm"),
            users: {
              admin: $localStorage.uid
            }
          };
          var coordinate = {latitude: lat, longitude: lng, range: liveEvent.range};

          var imgSrc = cordova.file.applicationDirectory + 'www/img/liveIcon.png';

          window.resolveLocalFileSystemURL(imgSrc, function (fileEntry) {
              // success callback; generates the FileEntry object needed to convert to Base64 string convert to Base64 string
              function win(file) {
                var reader = new FileReader();
                reader.onloadend = function (evt) {
                  var img = evt.target.result; // this is your Base64 string

                  var newEventKey = databaseMegaselfie.createEventMegaselfie(objToSend, coordinate, img);

                  objToSend.eventID = newEventKey;
                  objToSend.range = liveEvent.range;
                  shareData.setData(objToSend);
                  $state.go("countdown");
                };
                reader.readAsDataURL(file);
              };
              var fail = function () {
                console.log("Error file");
              };
              fileEntry.file(win, fail);
            },
            // error callback
            function (error) {
              console.log("Errore" + error)
            }
          );
        });
      };

      $scope.activateEventButton = function () {
        $scope.isDisabled = false;

      }
    }
  ])

  .controller('createSharedEventCtrl', ['$scope', 'dateFilter', '$http', '$cordovaCamera', '$localStorage', '$state', 'databaseMegaselfie', '$ionicPopup',
    function ($scope, dateFilter, $http, $cordovaCamera, $localStorage, $state, databaseMegaselfie, $ionicPopup) {

      $scope.date = dateFilter(new Date(), "dd/MM/yyyy");

      var event = $scope.event;

      $scope.submitData = function (event) {

        if ($scope.createSharedEventForm.$valid && $scope.imgURI) {
          var startTime = event.startTime || "00:00";
          var endTime = event.endTime || "00:00";

          var start = dateFilter(event.startDate, "dd/MM/yyyy") + " " + dateFilter(startTime, "HH:mm");
          var end = dateFilter(event.endDate, "dd/MM/yyyy") + " " + dateFilter(endTime, "HH:mm");

          var description = event.description;
          if (!description)
            description = "";

          var objToSend = {
            createdBy: $localStorage.profileData.name,
            title: event.nameSharedEvent,
            description: description,
            start: start,
            end: end,
            users: {
              admin: $localStorage.uid
            }
          };

          databaseMegaselfie.createEventMegaselfie(objToSend, null, $scope.imgURI);
          console.log($localStorage);
          setTimeout(function () {
            $state.go("menu.home");
          }, 2500);
        }
        else
          $ionicPopup.alert({
            title: 'Error',
            template: 'Input not valid'
          });
      };

      $scope.choosePhoto = function () {
        var imgRect = document.getElementById("createSharedEventContentId").getBoundingClientRect();
        console.log("rect= " + imgRect.width + " " + imgRect.height + " " + imgRect.bottom + " " + imgRect.left);
        var srcType = Camera.PictureSourceType.PHOTOLIBRARY;
        var options = setOptionsCamera(srcType, imgRect.width, imgRect.height);

        $cordovaCamera.getPicture(options).then(function (imageURI) {
          $scope.imgURI = "data:image/jpeg;base64," + imageURI;
        }, function (err) {
          console.log("error createSharedEventCtrl: " + err);
        });

      };
    }])

  .controller('menuCtrl', ['$scope', '$http', '$location', '$localStorage', '$ionicPopup',
    function ($scope, $http, $location, $localStorage, $ionicPopup) {

      $scope.init = function () {
        if ($localStorage.hasOwnProperty("accessToken") === true) {
          $http.get("https://graph.facebook.com/v2.2/me", {
            params: {
              access_token: $localStorage.accessToken,
              fields: "id,name,gender,location,website,picture.type(large),relationship_status",
              format: "json"
            }
          }).then(function (result) {
            $localStorage.profileData = $scope.profileData = result.data;
          }, function (error) {
            $ionicPopup.alert({
              title: 'Error',
              template: 'Your profile info cannot be retrieved.'
            });
            console.log(error);
          });
        }
      };
    }])

  .controller('loginCtrl', ['$scope', '$stateParams', '$firebaseObject', '$cordovaOauth', '$firebaseAuth', '$state', '$localStorage', 'databaseMegaselfie', '$ionicPopup',
    function ($scope, $stateParams, $firebaseObject, $cordovaOauth, $firebaseAuth, $state, $localStorage, databaseMegaselfie, $ionicPopup) {
      if ($localStorage.uid)
        $state.go("menu.home");
      else {
        $scope.login = function () {
          $cordovaOauth.facebook("727495594069595", ["email"]).then(function (result) {
            var credentials = firebase.auth.FacebookAuthProvider.credential(result.access_token);
            $localStorage.accessToken = result.access_token;
            return firebase.auth().signInWithCredential(credentials);
          }).then(function (firebaseUser) {
            //memorizza firebaseUser.uid
            $localStorage.uid = firebaseUser.uid;
            var refDB = window.database.ref();
            var refDBUsers = refDB.child("users/" + firebaseUser.uid);
            refDBUsers.once('value', function (snapshot) {

              //Se utente non esiste
              if (snapshot.val() === null) {

                databaseMegaselfie.enrollEvent('event1');


                $state.go("menu.home");

              } else { //se utente esiste già nel database
                $state.go("menu.home");
              }
            })
          }).catch(function (error) {
            $ionicPopup.alert({
              title: 'Error',
              template: 'Authentication failed'
            });
            console.error("Authentication failed:", error);
          });
        }
      }
    }
  ])


  .controller('storeCtrl', ['$scope', '$stateParams', // The following is the constructor function for this page's controller. See https://docs.angularjs.org/guide/controller
    // You can include any angular dependencies as parameters for this function
    // TIP: Access Route Parameters for your page via $stateParams.parameterName
    function ($scope, $stateParams) {


    }])

  .controller('cameraCtrl', ['$scope', '$stateParams', // The following is the constructor function for this page's controller. See https://docs.angularjs.org/guide/controller
    // You can include any angular dependencies as parameters for this function
    // TIP: Access Route Parameters for your page via $stateParams.parameterName
    function ($scope, $stateParams) {


    }])

  .controller('countdownCtrl', ['$scope', '$timeout', '$cordovaFile', '$stateParams', '$http', '$localStorage', '$state', 'shareData', 'databaseMegaselfie',
    function ($scope, $timeout, $cordovaFile, $stateParams, $http, $localStorage, $state, shareData, databaseMegaselfie) {

      var mytimeout;
      $scope.event = shareData.getData();
      console.log($scope.event);
      $scope.uid = $localStorage.uid;


      if (($scope.event.users && $scope.event.users.admin != $scope.uid) || ($scope.event.role && $scope.event.role != 'admin')) {
        var query = window.database.ref('events/' + $scope.event.eventID + "/" + "countdownStarted");
        query.on("value", function (snapshot) {
          console.log(snapshot.val());
          if (snapshot.val()) {
            mytimeout = $timeout($scope.onTimeout, 1000);
            $scope.started = true;
          }
        });
      }
      var rect = {x: 0, y: 0, width: window.screen.width, height: window.screen.height};
      cordova.plugins.camerapreview.startCamera(rect, 'front', true, true, true);
      $scope.onTimeout = function () {
        if ($scope.timer === 0) {
          $scope.$broadcast('timer-stopped', 0);
          $timeout.cancel(mytimeout);

          cordova.plugins.camerapreview.takePicture({maxWidth: window.screen.width, maxHeight: window.screen.height})
          cordova.plugins.camerapreview.setOnPictureTakenHandler(function (picture) {

            document.getElementById('originalPicture').src = picture[0];
            cordova.plugins.camerapreview.stopCamera();

            var img = document.getElementById('originalPicture').src;
            window.resolveLocalFileSystemURL(img, function (fileEntry) {
                // success callback; generates the FileEntry object needed to convert to Base64 string convert to Base64 string
                function win(file) {
                  var reader = new FileReader();
                  reader.onloadend = function (evt) {
                    var obj = evt.target.result; // this is your Base64 string
                    databaseMegaselfie.joinEvent($scope.event.eventID, obj, 'live');
                  };
                  reader.readAsDataURL(file);
                };
                var fail = function () {
                  console.log("Error file")
                };
                fileEntry.file(win, fail);
              },
              // error callback
              function (error) {
                console.log("Errore" + error)
              }
            );
          });
          return;
        }
        $scope.timer--;
        mytimeout = $timeout($scope.onTimeout, 1000);
      };
      // functions to control the timer starts the timer
      $scope.startTimer = function () {
        mytimeout = $timeout($scope.onTimeout, 1000);
        $scope.started = true;

        databaseMegaselfie.startLiveEvent($scope.event.eventID);
      };

      // triggered, when the timer stops, you can do something here, maybe show a visual indicator or vibrate the device
      $scope.$on('timer-stopped', function (event, remaining) {
        if (remaining === 0) {
          $scope.done = true;

        }
      });
      // UI When you press a timer button this function is called
      $scope.selectTimer = function (val) {
        $scope.timeForTimer = val;
        $scope.timer = val;
        $scope.started = false;
        $scope.paused = false;
        $scope.done = false;
      };

      // This function helps to display the time in a correct way in the center of the timer
      $scope.humanizeDurationTimer = function (input, units) {
        // units is a string with possible values of y, M, w, d, h, m, s, ms
        if (input == 0) {
          return 0;
        } else {
          var duration = moment().startOf('day').add(input, units);
          var format = "";
          if (duration.hour() > 0) {
            format += "H[h] ";
          }
          if (duration.minute() > 0) {
            format += "m[m] ";
          }
          if (duration.second() > 0) {
            format += "s[s] ";
          }
          return duration.format(format);
        }
      };

      $scope.uscita = function () {
        cordova.plugins.camerapreview.stopCamera();
        $state.go('menu.home');
      }
    }

  ])

  .controller('eventEditCtrl', ['$scope', '$stateParams', // The following is the constructor function for this page's controller. See https://docs.angularjs.org/guide/controller
    // You can include any angular dependencies as parameters for this function
    // TIP: Access Route Parameters for your page via $stateParams.parameterName
    function ($scope, $stateParams) {

    }])


  .controller('eventInfoCtrl', ['$scope', '$cordovaCamera', 'shareData', '$localStorage', 'databaseMegaselfie', '$ionicScrollDelegate',
    function ($scope, $cordovaCamera, shareData, $localStorage, databaseMegaselfie, $ionicScrollDelegate) {

      $scope.timestamp = new Date().getTime();

      $scope.obj = shareData.getData();

      $scope.takeImage = false;
      $scope.takePhoto = function () {
        $cordovaCamera.getPicture(setOptionsCamera(Camera.PictureSourceType.CAMERA)).then(function (imageData) {
          $scope.imgURI = "data:image/jpeg;base64," + imageData;
          $scope.takeImage = true;
          setTimeout(function() {
            $ionicScrollDelegate.$getByHandle('myview').scrollBottom(true);
          }, 1500);
        }, function (err) {
          console.log("error eventInfoCtrl " + err)
        });
      };

      $scope.sharePhoto = function () {
        databaseMegaselfie.joinEvent($scope.obj.eventID, $scope.imgURI)
      };
      $scope.shareLink = function () {
        window.plugins.socialsharing.shareWithOptions({message: 'megaselfie.com/events?eventId='+$scope.obj.eventID});
      };
    }])


  .controller('galleriaCtrl', ['$scope', '$stateParams', 'storage', '$firebaseObject', '$firebaseStorage', 'shareData', '$window',
    function ($scope, $stateParams, storage, $firebaseObject, $firebaseStorage, shareData, $window) {
      //funzione per il tasto di back
      $scope.$on('$ionicView.beforeEnter', function (event, viewData) {
        viewData.enableBack = true;
      });
      $scope.subtitle = {};


      $scope.lynk = {};
      $scope.prova = function () {

        $scope.items = [];
      //ottenere nome dell'evento selezionato passato attraverso il service
        $scope.data = shareData.getData();


        //  console.log("qua va" + $scope.data)
        //percorso per le foto degli eventi
        var query = firebase.database().ref("events/" + $scope.data.eventID + '/pictures');
        query.once("value")
          .then(function (snapshot) {
            snapshot.forEach(function (childSnapshot) {


              //  console.log(i)
              // childData will be the actual contents of the child
              var childData = childSnapshot.val();
              //variabili per inserire l'autore
              var ref = firebase.storage().ref($scope.data.eventID + '/' + childData);
              ref.getMetadata().then(function (metadata) {
                var storageFire = $firebaseStorage(ref);

                storageFire.$getDownloadURL().then(function (imgSrc) {

                  $scope.lynk = imgSrc.toString();

                  //inserisco l'autore della foto
                  // console.log($scope.subtitle)
                  if (metadata.customMetadata != null) {

                    $scope.subtitle = metadata.customMetadata.author;

                  }
                  else {
                    $scope.subtitle = 'N.A.'
                  }
                  $scope.items.push({src: $scope.lynk, sub: "Author: " + $scope.subtitle});
                })
              })
            });
          });

      };
      //istanziare la gallery
      $scope.prova();
    }]);

