import { isToday, isYesterday, differenceInDays,format } from 'date-fns';

export default function useDateFormat() {
  
    function getDateLabel(dateStr,formatType = 'simple') {
        const questionDate = new Date(dateStr);
        const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone;
        const today = isToday(questionDate, { timeZone: timeZone });
        const yesterday = isYesterday(questionDate, { timeZone: timeZone });
        const dateString = questionDate.toLocaleString();
      
        const daysDiffernece = differenceInDays(  
          new Date(),
          questionDate,
        )
      
        let label;
      
        if(formatType !== "simple"){
          return format(questionDate, formatType, { timeZone: timeZone })
        }
      
        if (today) {
          label = 'Today';
        } else if (yesterday) {
          label = 'Yesterday';
        } else if (daysDiffernece <= 7) {
          label = 'Previous 7 days';
        } else if (daysDiffernece <= 30) {
          label = 'Previous 30 days';
        } else {
          label = formatMonthName(questionDate) + ' ' + questionDate.getFullYear();
        }
        return label;
      }
      
      function formatMonthName(date) {
        const months = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
        return months[date.getMonth()];
      }
      
    return { getDateLabel };
  }