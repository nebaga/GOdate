document.addEventListener('DOMContentLoaded', function() {
    const form = document.getElementById('dateForm');
    const resultContainer = document.getElementById('resultContainer');
    const routeText = document.getElementById('routeText');
    const loader = document.getElementById('loader');
    const mapContainer = document.getElementById('map');
    const resultCity = document.getElementById('resultCity');
    const resultBudget = document.getElementById('resultBudget');
    const usedWords = document.getElementById('usedWords');
    
    // Элементы слайдеров
    const peopleSlider = document.getElementById('people');
    const peopleValue = document.getElementById('peopleValue');
    const placesSlider = document.getElementById('places');
    const placesValue = document.getElementById('placesValue');
    
    let map;
    let route = null;
    
    // Инициализация значений слайдеров
    peopleValue.textContent = peopleSlider.value;
    placesValue.textContent = placesSlider.value;
    
    // Обработчики изменения слайдеров
    peopleSlider.addEventListener('input', function() {
        peopleValue.textContent = this.value;
    });
    
    placesSlider.addEventListener('input', function() {
        placesValue.textContent = this.value;
    });

    // Инициализация Яндекс Карт
    function initMap() {
        ymaps.ready(() => {
            map = new ymaps.Map('map', {
                center: [55.76, 37.64],
                zoom: 10,
                controls: ['zoomControl', 'typeSelector', 'fullscreenControl']
            });
            
            // Если есть координаты при загрузке страницы
            if (window.coordinates && Object.keys(window.coordinates).length > 0) {
                updateMapWithRoute(window.coordinates);
            }
        });
    }
    
    initMap();
    
    // Обработка отправки формы
    form.addEventListener('submit', async function(e) {
        e.preventDefault();
        
        const city = document.getElementById('city').value;
        const budget = document.getElementById('budget').value;
        const people = document.getElementById('people').value;
        const places = document.getElementById('places').value;
        const transport = document.getElementById('transport').value;
        
        if (!city || !budget) {
            alert('Пожалуйста, заполните все обязательные поля');
            return;
        }
        
        loader.style.display = 'block';
        resultContainer.style.display = 'none';
        
        try {
            const formData = new FormData(form);
            const response = await fetch('/', {
                method: 'POST',
                body: formData
            });
            
            if (!response.ok) {
                throw new Error('Ошибка сервера');
            }
            
            const html = await response.text();
            const parser = new DOMParser();
            const doc = parser.parseFromString(html, 'text/html');
            
            const route = doc.querySelector('.route')?.textContent || '';
            const error = doc.querySelector('.error')?.textContent || '';
            const wordsCount = doc.querySelector('.info span')?.textContent || '';
            
            // Получаем новые координаты из скрипта в ответе
            const scriptContent = doc.querySelector('script[type="application/json"]')?.textContent;
            const newCoordinates = scriptContent ? JSON.parse(scriptContent) : {};
            
            if (error) {
                throw new Error(error);
            }
            
            // Обновляем данные в интерфейсе
            resultCity.textContent = city;
            resultBudget.textContent = budget;
            usedWords.textContent = wordsCount;
            
            // Очищаем предыдущий текст
            routeText.innerHTML = '';
            
            // Показываем контейнер с результатами
            resultContainer.style.display = 'block';
            loader.style.display = 'none';
            
            // Эффект печатающегося текста
            let i = 0;
            const speed = 20;
            
            function typeWriter() {
                if (i < route.length) {
                    const char = route.charAt(i);
                    
                    if (char === '*' && route.charAt(i+1) === '*') {
                        const endBold = route.indexOf('**', i+2);
                        if (endBold !== -1) {
                            const boldText = route.substring(i+2, endBold);
                            routeText.innerHTML += `<strong>${boldText}</strong>`;
                            i = endBold + 2;
                            setTimeout(typeWriter, speed);
                            return;
                        }
                    }
                    
                    routeText.innerHTML += char === '\n' ? '<br>' : char;
                    i++;
                    setTimeout(typeWriter, speed);
                } else {
                    routeText.classList.remove('typing-effect');
                }
            }
            
            routeText.classList.add('typing-effect');
            typeWriter();
            
            // Обновляем карту с новыми координатами
            if (Object.keys(newCoordinates).length > 0) {
                updateMapWithRoute(newCoordinates);
            }
            
        } catch (error) {
            console.error('Error:', error);
            loader.style.display = 'none';
            alert('Произошла ошибка: ' + error.message);
        }
    });
    
    // Обновление карты с маршрутом
    function updateMapWithRoute(coords) {
        if (!ymaps || !map) return;
        
        map.geoObjects.removeAll();
        
        const points = [];
        const placemarks = [];
        const routeColors = {
            'metro': '#FF0000',
            'tram': '#0066FF',
            'car': '#00AA00',
            'rental': '#FF9900',
            'own': '#9900FF',
            'taxi': '#000000',
            'boat': '#0099CC'
        };
        
        // Создаем массив точек маршрута
        Object.entries(coords).forEach(([place, coordStr]) => {
            // Удаляем возможные пробелы в координатах
            const cleanedCoordStr = coordStr.replace(/\s/g, '');
            const coords = cleanedCoordStr.split(',').map(Number);
            
            if (coords.length === 2 && !isNaN(coords[0]) && !isNaN(coords[1])) {
                points.push(coords);
                
                const placemark = new ymaps.Placemark(coords, {
                    hintContent: place,
                    balloonContent: place
                }, {
                    preset: 'islands#pinkDotIcon'
                });
                
                placemarks.push(placemark);
            }
        });
        
        // Добавляем метки на карту
        placemarks.forEach(mark => map.geoObjects.add(mark));
        
        // Если есть хотя бы 2 точки, строим маршрут
        if (points.length >= 2) {
            const transport = document.getElementById('transport').value;
            const color = routeColors[transport] || '#000000';
            
            ymaps.route(points, {
                mapStateAutoApply: true,
                routingMode: getRoutingMode(transport)
            }).then(function(route) {
                // Настраиваем внешний вид маршрута
                route.options.set({
                    strokeColor: color,
                    strokeWidth: 4,
                    strokeOpacity: 0.7
                });
                
                map.geoObjects.add(route);
                
                // Устанавливаем границы, чтобы весь маршрут был виден
                map.setBounds(route.getBounds(), {
                    checkZoomRange: true,
                    zoomMargin: 50
                });
            }).catch(error => {
                console.error('Ошибка построения маршрута:', error);
                // Если не удалось построить маршрут, просто показываем точки
                if (points.length > 0) {
                    map.setBounds(map.geoObjects.getBounds(), {
                        checkZoomRange: true,
                        zoomMargin: 50
                    });
                }
            });
        } else if (points.length === 1) {
            // Если только одна точка - центрируем на ней
            map.setCenter(points[0], 15);
        }
    }
    
    // Определение режима маршрутизации в зависимости от транспорта
    function getRoutingMode(transport) {
        switch(transport) {
            case 'trans':
                return 'masstransit';
            case 'car':
                return 'auto';
            case 'rental':
                return 'bicycle';
            case 'own':
                return 'bicycle';
            case 'taxi':
                return 'auto';
            case 'boat':
                return 'pedestrian'; // Для лодки нет специального режима
            default:
                return 'auto';
        }
    }
    
    // Инициализация карты с существующими координатами (если есть)
    if (window.coordinates && Object.keys(window.coordinates).length > 0) {
        updateMapWithRoute(window.coordinates);
    }
});