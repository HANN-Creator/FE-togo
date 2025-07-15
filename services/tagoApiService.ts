import axios from 'axios';

const API_KEY = 'cgGte%2F0Gz%2BVblH4HDJKw63E3Pjlist5Qw8Jda%2BObnJFXQaxLOOnJ1s91b2%2BNPbDuoygAThmigCYW%2FeY7L%2BglwA%3D%3D';

const busSttnInfoInstance = axios.create({
  baseURL: 'https://apis.data.go.kr/1613000/BusSttnInfoInqireService',
});

const busLcInfoInstance = axios.create({
  baseURL: 'https://apis.data.go.kr/1613000/BusLcInfoInqireService',
});

const arvlInfoInstance = axios.create({
  baseURL: 'https://apis.data.go.kr/1613000/ArvlInfoInqireService',
});

// GPS 좌표로 근처 정류장 조회
export const getNearbyStops = (gpslati: number, gpslong: number) => {
  return busSttnInfoInstance.get('/getCrdntPrxmtSttnList', {
    params: {
      serviceKey: API_KEY,
      gpsLati: gpslati,
      gpsLong: gpslong,
      _type: 'json',
    },
  });
};

// 정류장 도착 정보 조회
export const getArrivingBuses = (cityCode: string, nodeId: string) => {
  return arvlInfoInstance.get('/getSttnAcctoArvlInfoList', {
    params: {
      serviceKey: API_KEY,
      cityCode: cityCode,
      nodeId: nodeId,
      _type: 'json',
    },
  });
};

// 버스 위치 정보 조회
export const getBusLocation = (cityCode: string, routeId: string) => {
  return busLcInfoInstance.get('/getRouteAcctoBusLcList', {
    params: {
      serviceKey: API_KEY,
      cityCode: cityCode,
      routeId: routeId,
      _type: 'json',
    },
  });
};
