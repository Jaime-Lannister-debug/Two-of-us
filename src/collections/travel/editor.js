// 旅行日期区间与多家酒店编辑器。
import { $, esc, toast } from '../../core/dom.js';
export function createCollectionsTravelEditor(app) {
  const store = app.state;
  function setupTravelEditor(item) {
    let hotels = (
      item.hotels ||
      (item.hotel
        ? [
            {
              name: item.hotel,
            },
          ]
        : [])
    ).map((h) => ({
      ...h,
    }));
    const host = $('#hotelEditor');
    function draw() {
      host.innerHTML = `<h3>入住酒店（可添加多家）</h3><input type="hidden" name="hotelsJSON"><div>${hotels.map((h, i) => `<div class="hotel-row"><label>酒店名称<input data-hotel="${i}" data-key="name" maxlength="200" value="${esc(h.name)}"></label><label>入住日期<input type="date" data-hotel="${i}" data-key="checkIn" value="${esc(h.checkIn || '')}"></label><label>退房日期<input type="date" data-hotel="${i}" data-key="checkOut" value="${esc(h.checkOut || '')}"></label><label>备注<input data-hotel="${i}" data-key="note" maxlength="500" value="${esc(h.note || '')}"></label><button type="button" class="btn secondary" data-remove-hotel="${i}">移除酒店</button></div>`).join('')}</div><button class="btn secondary" type="button" id="addHotel">＋ 添加酒店</button>`;
      const sync = () => {
        $('[name=hotelsJSON]').value = JSON.stringify(hotels);
      };
      sync();
      host.querySelectorAll('[data-hotel]').forEach(
        (input) =>
          (input.oninput = () => {
            hotels[Number(input.dataset.hotel)][input.dataset.key] =
              input.value;
            sync();
          }),
      );
      host.querySelectorAll('[data-remove-hotel]').forEach(
        (b) =>
          (b.onclick = () => {
            hotels.splice(Number(b.dataset.removeHotel), 1);
            draw();
          }),
      );
      $('#addHotel').onclick = () => {
        if (hotels.length >= 20) {
          toast('每次行程最多添加 20 家酒店');
          return;
        }
        hotels.push({
          name: '',
          checkIn: '',
          checkOut: '',
          note: '',
        });
        draw();
      };
    }
    draw();
    const start = $('[name=date]'),
      end = $('[name=endDate]');
    end.min = start.value;
    start.oninput = () => {
      end.min = start.value;
    };
  }
  return {
    setupTravelEditor,
  };
}
