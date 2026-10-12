import React, { useState, useEffect, useRef } from 'react';
import { Search, Sparkles, Send, TrendingUp, DollarSign, BarChart2, Hash, Loader2, Bot, User, ChevronRight, Globe, MapPin, Check } from 'lucide-react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

const API_KEY = ""; // Môi trường tự động cung cấp API Key
const API_URL = `https://generativelanguage.googleapis.com/v1beta/models/gemini-3-flash-preview:generateContent?key=${API_KEY}`;

const VIETNAM_PROVINCES = [
  "Toàn quốc", "Hà Nội", "TP. Hồ Chí Minh", "Đà Nẵng", "Hải Phòng", "Cần Thơ",
  "An Giang", "Bà Rịa - Vũng Tàu", "Bắc Giang", "Bắc Kạn", "Bạc Liêu", "Bắc Ninh",
  "Bến Tre", "Bình Định", "Bình Dương", "Bình Phước", "Bình Thuận", "Cà Mau",
  "Cao Bằng", "Đắk Lắk", "Đắk Nông", "Điện Biên", "Đồng Nai", "Đồng Tháp",
  "Gia Lai", "Hà Giang", "Hà Nam", "Hà Tĩnh", "Hải Dương", "Hậu Giang",
  "Hòa Bình", "Hưng Yên", "Khánh Hòa", "Kiên Giang", "Kon Tum", "Lai Châu",
  "Lâm Đồng", "Lạng Sơn", "Lào Cai", "Long An", "Nam Định", "Nghệ An",
  "Ninh Bình", "Ninh Thuận", "Phú Thọ", "Phú Yên", "Quảng Bình", "Quảng Nam",
  "Quảng Ngãi", "Quảng Ninh", "Quảng Trị", "Sóc Trăng", "Sơn La", "Tây Ninh",
  "Thái Bình", "Thái Nguyên", "Thanh Hóa", "Thừa Thiên Huế", "Tiền Giang",
  "Trà Vinh", "Tuyên Quang", "Vĩnh Long", "Vĩnh Phúc", "Yên Bái"
];

const Sparkline = ({ data }) => {
  if (!data || data.length === 0) return null;
  const max = Math.max(...data);
  const min = Math.min(...data);
  const range = max - min === 0 ? 1 : max - min;
  
  const points = data.map((val, index) => {
    const x = (index / (data.length - 1)) * 100;
    const y = 100 - ((val - min) / range) * 100;
    return `${x},${y}`;
  }).join(' ');

  return (
    <svg viewBox="0 -10 100 120" className="w-24 h-8 overflow-visible">
      <polyline
        fill="none"
        stroke="#3b82f6"
        strokeWidth="3"
        strokeLinecap="round"
        strokeLinejoin="round"
        points={points}
      />
    </svg>
  );
};

export default function App() {
  // State quản lý tìm kiếm và dữ liệu từ khóa
  const [query, setQuery] = useState('');
  const [locationInput, setLocationInput] = useState('Toàn quốc');
  const [showDropdown, setShowDropdown] = useState(false);
  const dropdownRef = useRef(null);

  const [isSearching, setIsSearching] = useState(false);
  const [keywordData, setKeywordData] = useState([]);
  const [aggregates, setAggregates] = useState(null);

  // State quản lý Chat AI
  const [chatMessages, setChatMessages] = useState([
    { role: 'model', text: 'Chào bạn! Tôi là trợ lý AI. Hãy tìm kiếm một từ khóa SEO, sau đó tôi sẽ giúp bạn viết bài chuẩn SEO dựa trên danh sách từ khóa đó.' }
  ]);
  const [chatInput, setChatInput] = useState('');
  const [isChatting, setIsChatting] = useState(false);
  const chatEndRef = useRef(null);

  // Xử lý đóng Dropdown khi click ra ngoài
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setShowDropdown(false);
        // Không reset, giữ nguyên text để hỗ trợ nhập tự do (Free-text)
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const calculateAggregates = (data) => {
    if (!data || data.length === 0) return null;

    const totalKeywords = data.length;
    const totalVolume = data.reduce((sum, item) => sum + (item.volume || 0), 0);
    const avgCpc = data.reduce((sum, item) => sum + (item.cpc || 0), 0) / totalKeywords;
    const avgCompetition = data.reduce((sum, item) => sum + (item.competition || 0), 0) / totalKeywords;

    // Tính toán xu hướng trung bình 12 tháng
    const avgTrendData = Array(12).fill(0);
    data.forEach(item => {
      if (item.trend && item.trend.length === 12) {
        item.trend.forEach((val, idx) => {
          avgTrendData[idx] += val;
        });
      }
    });
    const formattedTrend = avgTrendData.map((val, index) => ({
      month: `Tháng ${index + 1}`,
      volume: Math.round(val / totalKeywords)
    }));

    return {
      totalKeywords,
      totalVolume,
      avgCpc: avgCpc.toFixed(2),
      avgCompetition: Math.round(avgCompetition),
      avgTrend: formattedTrend
    };
  };

  const handleSearch = async (e) => {
    e?.preventDefault();
    if (!query.trim()) return;

    setIsSearching(true);
    setKeywordData([]);
    setAggregates(null);
    setShowDropdown(false);

    const targetLocation = locationInput.trim() === 'Toàn quốc' || locationInput.trim() === '' ? 'Việt Nam' : `${locationInput.trim()}, Việt Nam`;

    const prompt = `Bạn là một chuyên gia SEO và công cụ phân tích từ khóa Google Ads. Hãy tìm 15 từ khóa liên quan chặt chẽ đến từ khóa gốc: "${query}", tập trung nhắm mục tiêu vào khu vực/thị trường: "${targetLocation}". 
    Lưu ý: Ngôn ngữ của từ khóa trả về, lượng volume, trend, cpc và độ cạnh tranh phải mô phỏng cho khu vực "${targetLocation}".
    Trả về dữ liệu dưới dạng mảng JSON gồm các đối tượng có cấu trúc sau:
    - "keyword": (string) Tên từ khóa.
    - "volume": (integer) Lượng tìm kiếm hàng tháng (từ 100 đến 100000).
    - "trend": (array of 12 integers) Mảng 12 số nguyên thể hiện xu hướng tìm kiếm trong 12 tháng qua.
    - "cpc": (number) Giá thầu CPC trung bình bằng USD (từ 0.1 đến 5.0).
    - "competition": (integer) Độ cạnh tranh từ 0 đến 100.`;

    const payload = {
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: {
        responseMimeType: "application/json",
        responseSchema: {
          type: "ARRAY",
          items: {
            type: "OBJECT",
            properties: {
              "keyword": { type: "STRING" },
              "volume": { type: "INTEGER" },
              "trend": { type: "ARRAY", items: { type: "INTEGER" } },
              "cpc": { type: "NUMBER" },
              "competition": { type: "INTEGER" }
            },
            propertyOrdering: ["keyword", "volume", "trend", "cpc", "competition"]
          }
        }
      }
    };

    try {
      const response = await fetch(API_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      const result = await response.json();
      
      if (result.candidates?.[0]?.content?.parts?.[0]?.text) {
        const jsonText = result.candidates[0].content.parts[0].text;
        const parsedData = JSON.parse(jsonText);
        setKeywordData(parsedData);
        setAggregates(calculateAggregates(parsedData));
        
        // Thêm tin nhắn hệ thống vào chat để AI biết bối cảnh mới
        setChatMessages(prev => [...prev, { 
          role: 'model', 
          text: `Tôi đã phân tích xong từ khóa "${query}" tại thị trường ${targetLocation}. Bạn có muốn tôi viết một dàn ý bài viết chuẩn SEO dựa trên các từ khóa này không?` 
        }]);
      }
    } catch (error) {
      console.error("Lỗi khi tìm từ khóa:", error);
    } finally {
      setIsSearching(false);
    }
  };

  const handleSendMessage = async (e) => {
    e?.preventDefault();
    if (!chatInput.trim() || isChatting) return;

    const userMessage = chatInput;
    setChatInput('');
    setChatMessages(prev => [...prev, { role: 'user', text: userMessage }]);
    setIsChatting(true);

    const targetLocation = locationInput.trim() === 'Toàn quốc' || locationInput.trim() === '' ? 'Việt Nam' : `${locationInput.trim()}, Việt Nam`;

    // Xây dựng ngữ cảnh gồm danh sách từ khóa hiện tại
    const keywordContext = keywordData.length > 0 
      ? `Danh sách từ khóa SEO hiện tại (Từ khóa gốc: ${query} - Khu vực: ${targetLocation}): \n` + keywordData.map(k => `- ${k.keyword} (Volume: ${k.volume})`).join('\n')
      : "Hiện chưa có danh sách từ khóa nào được tìm kiếm.";

    const systemInstruction = "Bạn là một trợ lý SEO Content Copywriter chuyên nghiệp. Nhiệm vụ của bạn là giúp người dùng viết cấu trúc bài viết (outline), tiêu đề (title), thẻ mô tả (meta description) hoặc toàn bộ bài viết dựa trên danh sách từ khóa SEO mà người dùng vừa tìm được. Hãy viết tự nhiên, hấp dẫn và tối ưu SEO.";

    const conversationHistory = chatMessages.map(msg => `${msg.role === 'user' ? 'Người dùng' : 'AI'}: ${msg.text}`).join('\n\n');
    
    const fullPrompt = `[Ngữ cảnh hệ thống: ${keywordContext}]\n\n[Lịch sử trò chuyện]\n${conversationHistory}\n\nNgười dùng: ${userMessage}\nAI:`;

    const payload = {
      contents: [{ role: 'user', parts: [{ text: fullPrompt }] }],
      systemInstruction: { parts: [{ text: systemInstruction }] }
    };

    try {
      const response = await fetch(API_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      const result = await response.json();
      
      if (!response.ok) {
        throw new Error(result.error?.message || "Lỗi phản hồi từ API");
      }

      if (result.candidates?.[0]?.content?.parts?.[0]?.text) {
        setChatMessages(prev => [...prev, { 
          role: 'model', 
          text: result.candidates[0].content.parts[0].text 
        }]);
      } else {
        throw new Error("Không nhận được text từ AI");
      }
    } catch (error) {
      console.error("Lỗi Chat AI:", error);
      setChatMessages(prev => [...prev, { 
        role: 'model', 
        text: 'Xin lỗi, đã có lỗi kết nối hoặc xử lý xảy ra. Vui lòng thử lại.' 
      }]);
    } finally {
      setIsChatting(false);
    }
  };

  // Cuộn chat xuống dưới cùng khi có tin nhắn mới
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [chatMessages]);

  return (
    <div className="min-h-screen bg-slate-50 font-sans text-slate-800">
      {/* Header & Search Bar */}
      <header className="bg-white border-b border-slate-200 sticky top-0 z-10 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="flex items-center gap-2 shrink-0">
              <div className="bg-blue-600 p-2 rounded-lg">
                <Sparkles className="w-6 h-6 text-white" />
              </div>
              <h1 className="text-xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-blue-600 to-indigo-600">
                SEO Keyword Tool Pro
              </h1>
            </div>
            
            <form onSubmit={handleSearch} className="flex-1 w-full max-w-4xl flex flex-col md:flex-row gap-2 relative">
              
              {/* Box Tìm kiếm & Chọn Địa Phương */}
              <div className="relative w-full md:w-64 shrink-0" ref={dropdownRef}>
                <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400 pointer-events-none" />
                <input
                  type="text"
                  value={locationInput}
                  onChange={(e) => {
                    setLocationInput(e.target.value);
                    setShowDropdown(true);
                  }}
                  onFocus={() => setShowDropdown(true)}
                  placeholder="Nhập tỉnh/thành phố..."
                  className="w-full pl-10 pr-4 py-3 rounded-xl border border-slate-300 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 shadow-sm transition-all outline-none bg-slate-50 text-sm font-medium text-slate-700"
                />
                
                {/* Dropdown danh sách Tỉnh/Thành */}
                {showDropdown && (
                  <div className="absolute top-[calc(100%+8px)] left-0 w-full max-h-60 overflow-y-auto bg-white border border-slate-200 rounded-xl shadow-lg z-50 animate-in fade-in zoom-in-95 duration-200">
                    {VIETNAM_PROVINCES.filter(p => p.toLowerCase().includes(locationInput.toLowerCase())).length === 0 ? (
                      <div 
                        className="px-4 py-3 text-sm text-blue-600 hover:bg-blue-50 cursor-pointer flex items-center justify-between"
                        onClick={() => setShowDropdown(false)}
                      >
                        <span>Sử dụng: "{locationInput}"</span>
                        <Check className="w-4 h-4" />
                      </div>
                    ) : (
                      <ul className="py-1">
                        {VIETNAM_PROVINCES
                          .filter(p => p.toLowerCase().includes(locationInput.toLowerCase()))
                          .map((province, idx) => (
                            <li 
                              key={idx}
                              onClick={() => {
                                setLocationInput(province);
                                setShowDropdown(false);
                              }}
                              className={`px-4 py-2.5 text-sm cursor-pointer hover:bg-blue-50 flex items-center justify-between transition-colors ${locationInput === province ? 'bg-blue-50/80 text-blue-700 font-medium' : 'text-slate-700'}`}
                            >
                              {province}
                              {locationInput === province && <Check className="w-4 h-4" />}
                            </li>
                          ))
                        }
                      </ul>
                    )}
                  </div>
                )}
              </div>

              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400 pointer-events-none" />
                <input
                  type="text"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Nhập từ khóa (VD: cách giảm cân...)"
                  className="w-full pl-10 pr-4 py-3 rounded-xl border border-slate-300 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 shadow-sm transition-all outline-none"
                />
              </div>
              <button 
                type="submit"
                disabled={isSearching || !query.trim()}
                className="bg-blue-600 hover:bg-blue-700 text-white px-4 sm:px-6 py-3 rounded-xl font-medium flex items-center justify-center gap-2 transition-colors disabled:opacity-70 disabled:cursor-not-allowed shrink-0"
              >
                {isSearching ? <Loader2 className="w-5 h-5 animate-spin" /> : <span className="hidden sm:inline">Phân tích</span>}
                {!isSearching && <Search className="w-5 h-5 sm:hidden" />}
              </button>
            </form>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 flex flex-col gap-8">
        
        {}
        {aggregates && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
            {/* Thẻ chỉ số tổng hợp */}
            <div className="lg:col-span-1 grid grid-cols-2 gap-4">
              <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex flex-col justify-center">
                <div className="flex items-center gap-2 text-slate-500 mb-2">
                  <Hash className="w-4 h-4" />
                  <span className="text-sm font-medium">Tổng từ khóa</span>
                </div>
                <div className="text-3xl font-bold text-slate-900">{aggregates.totalKeywords}</div>
              </div>
              
              <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex flex-col justify-center">
                <div className="flex items-center gap-2 text-slate-500 mb-2">
                  <BarChart2 className="w-4 h-4" />
                  <span className="text-sm font-medium">Tổng Volume</span>
                </div>
                <div className="text-3xl font-bold text-slate-900">{aggregates.totalVolume.toLocaleString()}</div>
              </div>

              <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex flex-col justify-center">
                <div className="flex items-center gap-2 text-slate-500 mb-2">
                  <DollarSign className="w-4 h-4" />
                  <span className="text-sm font-medium">CPC Trung bình</span>
                </div>
                <div className="text-3xl font-bold text-slate-900">${aggregates.avgCpc}</div>
              </div>

              <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex flex-col justify-center">
                <div className="flex items-center gap-2 text-slate-500 mb-2">
                  <TrendingUp className="w-4 h-4" />
                  <span className="text-sm font-medium">Cạnh tranh TB</span>
                </div>
                <div className="text-3xl font-bold text-slate-900 flex items-baseline gap-1">
                  {aggregates.avgCompetition}<span className="text-lg text-slate-400 font-normal">/100</span>
                </div>
              </div>
            </div>

            {/* Biểu đồ xu hướng tổng hợp */}
            <div className="lg:col-span-2 bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
              <h3 className="text-base font-semibold mb-6 flex items-center gap-2">
                <TrendingUp className="w-5 h-5 text-blue-500" />
                Xu hướng tìm kiếm trung bình (12 Tháng)
              </h3>
              <div className="h-48 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={aggregates.avgTrend}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                    <XAxis dataKey="month" axisLine={false} tickLine={false} tick={{fill: '#64748b', fontSize: 12}} />
                    <YAxis axisLine={false} tickLine={false} tick={{fill: '#64748b', fontSize: 12}} />
                    <Tooltip 
                      contentStyle={{borderRadius: '12px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)'}}
                    />
                    <Line type="monotone" dataKey="volume" stroke="#3b82f6" strokeWidth={3} dot={{r: 4, fill: '#3b82f6', strokeWidth: 2, stroke: '#fff'}} activeDot={{r: 6}} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>
        )}

        {/* Màn hình chờ khi chưa tìm kiếm */}
        {!isSearching && !aggregates && (
          <div className="flex flex-col items-center justify-center py-20 text-center px-4">
            <div className="bg-blue-50 w-24 h-24 rounded-full flex items-center justify-center mb-6">
              <Search className="w-10 h-10 text-blue-500" />
            </div>
            <h2 className="text-2xl font-bold text-slate-800 mb-2">Bắt đầu nghiên cứu từ khóa</h2>
            <p className="text-slate-500 max-w-md">Nhập một từ khóa bất kỳ vào ô tìm kiếm phía trên để phân tích lưu lượng, xu hướng, CPC và sử dụng AI để lên dàn ý bài viết.</p>
          </div>
        )}

        {/* Màn hình loading */}
        {isSearching && (
          <div className="flex flex-col items-center justify-center py-20">
            <Loader2 className="w-10 h-10 text-blue-500 animate-spin mb-4" />
            <p className="text-slate-500">Đang thu thập và phân tích dữ liệu từ khóa...</p>
          </div>
        )}

        {}
        {keywordData.length > 0 && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 animate-in fade-in slide-in-from-bottom-8 duration-700">
            
            {/* Bảng danh sách từ khóa (Cột trái - Chiếm 2/3) */}
            <div className="lg:col-span-2 bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden flex flex-col h-[600px]">
              <div className="px-6 py-4 border-b border-slate-200 bg-slate-50/50">
                <h3 className="font-semibold text-slate-800">Ý tưởng từ khóa (Danh sách chi tiết)</h3>
              </div>
              <div className="overflow-auto flex-1">
                <table className="w-full text-left text-sm whitespace-nowrap">
                  <thead className="bg-white sticky top-0 z-10 outline outline-1 outline-slate-200">
                    <tr className="text-slate-500">
                      <th className="px-6 py-4 font-medium">Từ khóa</th>
                      <th className="px-6 py-4 font-medium text-right">Volume</th>
                      <th className="px-6 py-4 font-medium">Trend (12T)</th>
                      <th className="px-6 py-4 font-medium text-right">CPC (USD)</th>
                      <th className="px-6 py-4 font-medium text-right">Cạnh tranh</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {keywordData.map((item, index) => (
                      <tr key={index} className="hover:bg-slate-50/80 transition-colors">
                        <td className="px-6 py-4 font-medium text-slate-800">{item.keyword}</td>
                        <td className="px-6 py-4 text-right text-slate-600">{item.volume.toLocaleString()}</td>
                        <td className="px-6 py-4">
                          <Sparkline data={item.trend} />
                        </td>
                        <td className="px-6 py-4 text-right text-slate-600">${item.cpc.toFixed(2)}</td>
                        <td className="px-6 py-4 text-right">
                          <div className="flex items-center justify-end gap-2">
                            <div className="w-16 h-2 bg-slate-100 rounded-full overflow-hidden">
                              <div 
                                className={`h-full rounded-full ${item.competition > 70 ? 'bg-red-500' : item.competition > 30 ? 'bg-yellow-500' : 'bg-green-500'}`}
                                style={{width: `${item.competition}%`}}
                              ></div>
                            </div>
                            <span className="text-xs text-slate-500 w-6">{item.competition}</span>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Trợ lý AI Viết bài (Cột phải - Chiếm 1/3) */}
            <div className="lg:col-span-1 bg-white rounded-2xl border border-slate-200 shadow-sm flex flex-col h-[600px] overflow-hidden">
              <div className="px-6 py-4 border-b border-slate-200 bg-gradient-to-r from-blue-50 to-indigo-50 flex items-center gap-3">
                <div className="bg-white p-1.5 rounded-lg shadow-sm text-blue-600">
                  <Bot className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-semibold text-slate-800">Trợ lý AI Content</h3>
                  <p className="text-xs text-slate-500">Tạo outline & viết bài chuẩn SEO</p>
                </div>
              </div>
              
              {/* Khu vực hiển thị tin nhắn */}
              <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-slate-50/30">
                {chatMessages.map((msg, index) => (
                  <div key={index} className={`flex gap-3 ${msg.role === 'user' ? 'flex-row-reverse' : ''}`}>
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 ${msg.role === 'user' ? 'bg-blue-600 text-white' : 'bg-white border border-slate-200 text-blue-600'}`}>
                      {msg.role === 'user' ? <User className="w-4 h-4" /> : <Bot className="w-4 h-4" />}
                    </div>
                    <div className={`px-4 py-3 rounded-2xl max-w-[85%] text-sm leading-relaxed ${
                      msg.role === 'user' 
                        ? 'bg-blue-600 text-white rounded-tr-sm' 
                        : 'bg-white border border-slate-200 text-slate-700 rounded-tl-sm whitespace-pre-wrap shadow-sm'
                    }`}>
                      {msg.text}
                    </div>
                  </div>
                ))}
                {isChatting && (
                  <div className="flex gap-3">
                    <div className="w-8 h-8 rounded-full bg-white border border-slate-200 text-blue-600 flex items-center justify-center shrink-0">
                      <Bot className="w-4 h-4" />
                    </div>
                    <div className="px-4 py-3 rounded-2xl bg-white border border-slate-200 text-slate-500 rounded-tl-sm shadow-sm flex gap-1 items-center">
                      <div className="w-2 h-2 bg-slate-300 rounded-full animate-bounce" style={{animationDelay: '0ms'}}></div>
                      <div className="w-2 h-2 bg-slate-300 rounded-full animate-bounce" style={{animationDelay: '150ms'}}></div>
                      <div className="w-2 h-2 bg-slate-300 rounded-full animate-bounce" style={{animationDelay: '300ms'}}></div>
                    </div>
                  </div>
                )}
                <div ref={chatEndRef} />
              </div>

              {/* Khu vực nhập tin nhắn */}
              <div className="p-4 bg-white border-t border-slate-200">
                <form onSubmit={handleSendMessage} className="relative">
                  <input
                    type="text"
                    value={chatInput}
                    onChange={(e) => setChatInput(e.target.value)}
                    placeholder="VD: Viết cho tôi dàn ý bài viết..."
                    className="w-full pl-4 pr-12 py-3 rounded-xl border border-slate-200 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-slate-50 transition-all outline-none text-sm"
                    disabled={isChatting}
                  />
                  <button 
                    type="submit"
                    disabled={!chatInput.trim() || isChatting}
                    className="absolute right-2 top-1/2 -translate-y-1/2 p-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:hover:bg-blue-600"
                  >
                    <Send className="w-4 h-4" />
                  </button>
                </form>
              </div>
            </div>

          </div>
        )}
      </main>
    </div>
  );
}