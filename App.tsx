import React, {useState, useEffect, useRef} from 'react';
import {
  PermissionsAndroid,
  Platform,
  SafeAreaView,
  StyleSheet,
  Text,
  View,
  Button,
  FlatList,
  TouchableOpacity,
  Alert,
} from 'react-native';
import Geolocation from 'react-native-geolocation-service';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  getNearbyStops,
  getArrivingBuses,
  getBusLocation,
} from './src/services/tagoApiService';

// Haversine formula to calculate distance between two coordinates
const getDistance = (lat1, lon1, lat2, lon2) => {
  const R = 6371; // Radius of the earth in km
  const dLat = deg2rad(lat2 - lat1);
  const dLon = deg2rad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(deg2rad(lat1)) *
      Math.cos(deg2rad(lat2)) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  const d = R * c; // Distance in km
  return d * 1000; // Distance in meters
};

const deg2rad = deg => {
  return deg * (Math.PI / 180);
};

const App = () => {
  const [location, setLocation] = useState(null);
  const [stops, setStops] = useState([]);
  const [selectedStop, setSelectedStop] = useState(null);
  const [buses, setBuses] = useState([]);
  const [selectedBus, setSelectedBus] = useState(null);
  const [trackingInterval, setTrackingInterval] = useState(null);
  const [totalDistance, setTotalDistance] = useState(0);
  const [points, setPoints] = useState(0);

  const lastPosition = useRef(null);

  useEffect(() => {
    requestLocationPermission();
  }, []);

  const requestLocationPermission = async () => {
    if (Platform.OS === 'ios') {
      Geolocation.requestAuthorization('whenInUse');
      getLocation();
    } else {
      try {
        const granted = await PermissionsAndroid.request(
          PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION,
          {
            title: 'Location Permission',
            message: 'This app needs access to your location.',
            buttonNeutral: 'Ask Me Later',
            buttonNegative: 'Cancel',
            buttonPositive: 'OK',
          },
        );
        if (granted === PermissionsAndroid.RESULTS.GRANTED) {
          getLocation();
        } else {
          console.log('Location permission denied');
        }
      } catch (err) {
        console.warn(err);
      }
    }
  };

  const getLocation = () => {
    Geolocation.getCurrentPosition(
      position => {
        const {latitude, longitude} = position.coords;
        setLocation({latitude, longitude});
        fetchNearbyStops(latitude, longitude);
      },
      error => {
        console.log(error.code, error.message);
      },
      {enableHighAccuracy: true, timeout: 15000, maximumAge: 10000},
    );
  };

  const fetchNearbyStops = async (latitude, longitude) => {
    try {
      const response = await getNearbyStops(latitude, longitude);
      setStops(response.data.response.body.items.item);
    } catch (error) {
      console.error('Error fetching nearby stops:', error);
    }
  };

  const handleSelectStop = async stop => {
    setSelectedStop(stop);
    try {
      const response = await getArrivingBuses(stop.citycode, stop.nodeid);
      setBuses(response.data.response.body.items.item);
    } catch (error) {
      console.error('Error fetching arriving buses:', error);
    }
  };

  const handleSelectBus = bus => {
    setSelectedBus(bus);
    startTracking(bus);
  };

  const startTracking = bus => {
    lastPosition.current = null; // Reset last position
    setTotalDistance(0);

    const interval = setInterval(async () => {
      Geolocation.getCurrentPosition(
        async position => {
          const {latitude, longitude} = position.coords;
          const busLocationResponse = await getBusLocation(
            selectedStop.citycode,
            bus.routeid,
          );
          const busItems = busLocationResponse.data.response.body.items.item;
          // Find the specific bus we are tracking
          const currentBus = busItems.find(b => b.vehicleno === bus.vehicleno);

          if (currentBus) {
            const distanceToBus = getDistance(
              latitude,
              longitude,
              currentBus.gpslati,
              currentBus.gpslong,
            );

            if (distanceToBus < 100) {
              // If within 100 meters, consider it a success
              if (lastPosition.current) {
                const movedDistance = getDistance(
                  lastPosition.current.latitude,
                  lastPosition.current.longitude,
                  latitude,
                  longitude,
                );
                setTotalDistance(prev => prev + movedDistance);
              }
              lastPosition.current = {latitude, longitude};
              Alert.alert('Tracking Success', 'You are on the bus!');
            } else {
              // If too far, tracking fails for this interval
              Alert.alert(
                'Tracking Failed',
                'You seem to be too far from the bus.',
              );
            }
          } else {
            Alert.alert('Bus location not available.');
          }
        },
        error => {
          console.log('Error getting current location:', error);
        },
        {enableHighAccuracy: true, timeout: 15000, maximumAge: 10000},
      );
    }, 60000); // 60 seconds

    setTrackingInterval(interval);
  };

  const stopTracking = () => {
    if (trackingInterval) {
      clearInterval(trackingInterval);
      setTrackingInterval(null);
      const calculatedPoints = Math.floor(totalDistance); // 1 point per meter
      setPoints(calculatedPoints);
      savePoints(calculatedPoints);
      Alert.alert(
        'Tracking Finished',
        `You earned ${calculatedPoints} points for traveling ${totalDistance.toFixed(
          2,
        )} meters.`,
      );
      // Reset states
      setSelectedBus(null);
      setTotalDistance(0);
      lastPosition.current = null;
    }
  };

  const savePoints = async newPoints => {
    try {
      const existingPoints = await AsyncStorage.getItem('user_points');
      const totalPoints = (existingPoints ? parseInt(existingPoints, 10) : 0) + newPoints;
      await AsyncStorage.setItem('user_points', totalPoints.toString());
    } catch (e) {
      console.error('Failed to save points.');
    }
  };

  const renderItem = ({item}) => (
    <TouchableOpacity
      style={styles.item}
      onPress={() => (selectedStop ? handleSelectBus(item) : handleSelectStop(item))}>
      <Text style={styles.title}>
        {selectedStop ? item.routeno : item.nodenm}
      </Text>
      <Text>{selectedStop ? `${item.arrtime} seconds` : item.nodeid}</Text>
    </TouchableOpacity>
  );

  return (
    <SafeAreaView style={styles.container}>
      {!location && <Text>Getting your location...</Text>}
      {location && !selectedStop && (
        <View>
          <Text style={styles.header}>Nearby Bus Stops</Text>
          <FlatList
            data={stops}
            renderItem={renderItem}
            keyExtractor={item => item.nodeid}
          />
        </View>
      )}
      {selectedStop && !selectedBus && (
        <View>
          <Text style={styles.header}>Arriving Buses at {selectedStop.nodenm}</Text>
          <FlatList
            data={buses}
            renderItem={renderItem}
            keyExtractor={item => item.routeid + item.arrtime}
          />
          <Button title="Back to Stops" onPress={() => setSelectedStop(null)} />
        </View>
      )}
      {selectedBus && (
        <View style={styles.trackingContainer}>
          <Text style={styles.header}>Tracking Bus {selectedBus.routeno}</Text>
          <Text>Total Distance: {totalDistance.toFixed(2)} meters</Text>
          <Text>Points Earned So Far: {Math.floor(totalDistance)}</Text>
          <Button title="Complete Ride & Get Points" onPress={stopTracking} />
        </View>
      )}
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    marginTop: 20,
  },
  item: {
    backgroundColor: '#f9c2ff',
    padding: 20,
    marginVertical: 8,
    marginHorizontal: 16,
  },
  title: {
    fontSize: 24,
  },
  header: {
    fontSize: 32,
    fontWeight: 'bold',
    textAlign: 'center',
    marginVertical: 10,
  },
  trackingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
});

export default App;