package data

type Stock struct {
	Code     string `json:"code"`
	Name     string `json:"name"`
	Exchange string `json:"exchange"`
}

type Bar struct {
	Date      string  `json:"date"`
	Open      float64 `json:"open"`
	High      float64 `json:"high"`
	Low       float64 `json:"low"`
	Close     float64 `json:"close"`
	Volume    float64 `json:"volume"`
	Amount    float64 `json:"amount"`
	ChangePct float64 `json:"changePct"`
}

type Provider interface {
	Stocks(query string, limit int) ([]Stock, error)
	Market(code string, start string, end string, kType int) ([]Bar, error)
}
