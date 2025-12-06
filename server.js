require("dotenv").config();
const express = require("express");
const cors = require("cors");
const axios = require("axios");

const app = express();
const PORT = process.env.PORT || 3000;

// CWA API 設定
const CWA_API_BASE_URL = "https://opendata.cwa.gov.tw/api";
const CWA_API_KEY = process.env.CWA_API_KEY;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

/**
 * 取得高雄天氣預報
 * CWA 氣象資料開放平臺 API
 * 使用「一般天氣預報-今明 36 小時天氣預報」資料集
 */
const getAllTaiwanWeather = async (req, res) => {
  try {
    if (!CWA_API_KEY) {
      return res.status(500).json({
        error: "伺服器設定錯誤",
        message: "請在 .env 檔案中設定 CWA_API_KEY",
      });
    }

    // 1. 修改 API 請求：移除 locationName 參數
    const response = await axios.get(
      `${CWA_API_BASE_URL}/v1/rest/datastore/F-C0032-001`,
      {
        params: {
          Authorization: CWA_API_KEY,
          // locationName: "宜蘭縣", // <--- 把這行註解掉或刪除
        },
      }
    );

    // 取得所有地點的列表 (這是一個陣列)
    const allLocations = response.data.records.location;

    // 2. 修改資料處理：使用 map 遍歷所有縣市
    const formattedData = allLocations.map((locationData) => {
      
      // 整理該縣市的天氣預報
      const weatherElements = locationData.weatherElement;
      // 假設每個要素的時間段長度都一樣，取第一個的時間長度
      const timeCount = weatherElements[0].time.length;
      
      const forecasts = [];

      for (let i = 0; i < timeCount; i++) {
        const forecast = {
          startTime: weatherElements[0].time[i].startTime,
          endTime: weatherElements[0].time[i].endTime,
          weather: "",
          rain: "",
          minTemp: "",
          maxTemp: "",
          comfort: "",
          windSpeed: "", // 註：F-C0032-001 通常只包含 Wx, PoP, MinT, CI, MaxT，不一定有 WS (風速)
        };

        weatherElements.forEach((element) => {
          // 確保該時間段存在
          if (element.time[i]) {
            const value = element.time[i].parameter;
            switch (element.elementName) {
              case "Wx":
                forecast.weather = value.parameterName;
                break;
              case "PoP":
                forecast.rain = value.parameterName + "%";
                break;
              case "MinT":
                forecast.minTemp = value.parameterName + "°C";
                break;
              case "MaxT":
                forecast.maxTemp = value.parameterName + "°C";
                break;
              case "CI":
                forecast.comfort = value.parameterName;
                break;
              // 一般天氣預報 (F-C0032-001) 有時不包含風速，視 API 回傳而定
              case "WS": 
                forecast.windSpeed = value.parameterName;
                break;
            }
          }
        });
        forecasts.push(forecast);
      }

      // 回傳單一縣市整理好的物件
      return {
        city: locationData.locationName,
        forecasts: forecasts,
      };
    });

    res.json({
      success: true,
      data: {
        updateTime: response.data.records.datasetDescription,
        locations: formattedData, // 這裡是所有縣市的陣列
      },
    });


  } catch (error) {
    console.error("取得天氣資料失敗:", error.message);

    if (error.response) {
      // API 回應錯誤
      return res.status(error.response.status).json({
        error: "CWA API 錯誤",
        message: error.response.data.message || "無法取得天氣資料",
        details: error.response.data,
      });
    }

    // 其他錯誤
    res.status(500).json({
      error: "伺服器錯誤",
      message: "無法取得天氣資料，請稍後再試",
    });
  }
};

// Routes
app.get("/", (req, res) => {
  res.json({
    message: "歡迎使用 CWA 天氣預報 API",
    endpoints: {
      allcityweather: "/api/weather/all",
      health: "/api/health",
    },
  });
});

app.get("/api/health", (req, res) => {
  res.json({ status: "OK", timestamp: new Date().toISOString() });
});

// 取得高雄天氣預報
app.get("/api/weather/all", getAllTaiwanWeather);

// Error handling middleware
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({
    error: "伺服器錯誤",
    message: err.message,
  });
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({
    error: "找不到此路徑",
  });
});

app.listen(PORT, () => {
  console.log(`🚀 伺服器運行已運作`);
  console.log(`📍 環境: ${process.env.NODE_ENV || "development"}`);
});
