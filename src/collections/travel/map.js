// 旅行地图、选点和底图状态。
import { $, esc, toast } from '../../core/dom.js';
import { coordinate } from '../../core/numbers.js';
export function createCollectionsTravelMap(app) {
  const store = app.state;
  function initMap(arr) {
    const container = $('#map');
    if (!window.L) {
      container.innerHTML =
        '<p style="padding:35px">地图组件未加载，请检查网络后刷新。下方时间线仍可查看和编辑行程。</p>';
      return;
    }
    store.map = window.L.map('map', {
      worldCopyJump: true,
    }).setView([31, 116], 4);
    // 使用 OSM 标准瓦片；保留署名，不预取或批量下载。
    const tiles = window.L.tileLayer(
      'https://tile.openstreetmap.org/{z}/{x}/{y}.png',
      {
        attribution:
          '&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener">OpenStreetMap</a> contributors',
        maxZoom: 19,
        updateWhenIdle: true,
        keepBuffer: 2,
      },
    );
    const status = document.createElement('div');
    status.className = 'map-load-status';
    status.setAttribute('role', 'status');
    status.textContent = '地图加载中…';
    container.append(status);
    let loaded = 0;
    tiles.on('tileload', () => {
      loaded++;
      status.hidden = true;
    });
    tiles.on('tileerror', () => {
      if (!loaded) {
        status.hidden = false;
        status.textContent = '底图加载失败，请检查网络；行程记录仍可使用。';
      }
    });
    tiles.addTo(store.map);
    const points = arr.filter(
      (r) =>
        coordinate(r.lat, 90) !== undefined &&
        coordinate(r.lng, 180) !== undefined,
    );
    points.forEach((r) =>
      window.L.circleMarker([Number(r.lat), Number(r.lng)], {
        radius: 9,
        color: '#efb994',
        fillColor: '#efb994',
        fillOpacity: 0.85,
        weight: 3,
        bubblingMouseEvents: false,
      })
        .addTo(store.map)
        .bindPopup(esc(r.title) + '<br>' + esc(r.date)),
    );
    if (points.length > 1)
      store.map.fitBounds(
        points.map((r) => [r.lat, r.lng]),
        {
          padding: [45, 45],
          maxZoom: 7,
        },
      );
    else if (points.length === 1)
      store.map.setView([Number(points[0].lat), Number(points[0].lng)], 9);
    let draftMarker = null;
    function showDraft() {
      if (draftMarker) store.map.removeLayer(draftMarker);
      if (store.selectedTripPoint)
        draftMarker = window.L.circleMarker(
          [store.selectedTripPoint.lat, store.selectedTripPoint.lng],
          {
            radius: 10,
            color: '#e8a4b4',
            fillColor: '#e8a4b4',
            fillOpacity: 0.6,
            weight: 3,
            bubblingMouseEvents: false,
          },
        )
          .addTo(store.map)
          .bindPopup('待保存的旅行地点');
    }
    showDraft();
    store.map.on('click', (event) => {
      const lat = coordinate(event.latlng.lat, 90);
      const lng = coordinate(
        ((((event.latlng.lng + 180) % 360) + 360) % 360) - 180,
        180,
      );
      if (lat === undefined || lng === undefined) return;
      store.selectedTripPoint = {
        lat: Number(lat.toFixed(6)),
        lng: Number(lng.toFixed(6)),
      };
      showDraft();
      toast('地点已选中，点击「新增回忆」保存行程');
    });
  }
  return {
    initMap,
  };
}
