import config from '../../config.js';
import React from 'react'
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer
} from 'recharts'

const data = [
  { name: 'Mon', sent: 400 },
  { name: 'Tue', sent: 300 },
  { name: 'Wed', sent: 600 },
  { name: 'Thu', sent: 800 },
  { name: 'Fri', sent: 500 },
  { name: 'Sat', sent: 900 },
  { name: 'Sun', sent: 1100 },
]

const CustomTooltip = ({ active, payload }) => {
  if (active && payload && payload.length) {
    return (
      <div className="chart-tooltip">
        <p className="label">{`${payload[0].value} messages`}</p>
      </div>
    )
  }
  return null
}

const ActivityChart = () => {
  const [chartData, setChartData] = React.useState([])
  const [loading, setLoading] = React.useState(true)

  React.useEffect(() => {
    fetch(config.API_URL + "/stats/broadcast-activity")
      .then(res => res.json())
      .then(data => {
        setChartData(data)
        setLoading(false)
      })
      .catch(err => {
        console.error('Failed to fetch activity stats', err)
        setLoading(false)
      })
  }, [])

  if (loading) return <div className="skeleton-pulse" style={{ height: 300, width: '100%', borderRadius: 16 }} />

  return (
    <div className="activity-chart-container">
      <ResponsiveContainer width="100%" height={300}>
        <AreaChart
          data={chartData}
          margin={{ top: 10, right: 10, left: -20, bottom: 0 }}
        >
          <defs>
            <linearGradient id="colorSent" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="var(--accent)" stopOpacity={0.3} />
              <stop offset="95%" stopColor="var(--accent)" stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(255,255,255,0.05)" />
          <XAxis 
            dataKey="name" 
            axisLine={false} 
            tickLine={false} 
            tick={{ fill: 'var(--text-muted)', fontSize: 12 }}
            dy={10}
          />
          <YAxis 
            axisLine={false} 
            tickLine={false} 
            tick={{ fill: 'var(--text-muted)', fontSize: 12 }}
          />
          <Tooltip content={<CustomTooltip />} />
          <Area
            type="monotone"
            dataKey="sent"
            stroke="var(--accent)"
            strokeWidth={3}
            fillOpacity={1}
            fill="url(#colorSent)"
            animationDuration={1500}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  )
}

export default ActivityChart
