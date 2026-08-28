/**
 * 📷 클라이언트 자동 이미지 압축 유틸리티
 * - 스마트폰 원본 사진(4~8MB)을 1400px / JPEG 80%로 자동 리사이징 & 압축
 * - 수학 문제 글씨가 또렷하게 보이면서도 용량을 95% 이상 대폭 절감 (약 150~200KB)
 * - PDF 등 비이미지 파일은 원본 그대로 반환
 */

export async function compressImage(file, maxDimension = 1400, quality = 0.82) {
  if (!file) return file;

  // 이미지 파일이 아닌 경우(예: PDF) 원본 그대로 반환
  if (!file.type || !file.type.startsWith('image/')) {
    return file;
  }

  return new Promise((resolve) => {
    try {
      const reader = new FileReader();
      reader.onload = (event) => {
        const img = new Image();
        img.onload = () => {
          let { width, height } = img;

          // 긴 축을 기준으로 최대 maxDimension(1400px)으로 비례 축소
          if (width > maxDimension || height > maxDimension) {
            if (width > height) {
              height = Math.round((height * maxDimension) / width);
              width = maxDimension;
            } else {
              width = Math.round((width * maxDimension) / height);
              height = maxDimension;
            }
          }

          const canvas = document.createElement('canvas');
          canvas.width = width;
          canvas.height = height;

          const ctx = canvas.getContext('2d');
          if (!ctx) {
            return resolve(file); // 캔버스 미지원 시 원본 반환
          }

          // 흰색 배경 채우기 (투명 PNG 등이 검게 변하는 현상 방지)
          ctx.fillStyle = '#ffffff';
          ctx.fillRect(0, 0, width, height);

          // 이미지 캔버스에 그리기
          ctx.drawImage(img, 0, 0, width, height);

          // JPEG 형식으로 압축
          canvas.toBlob(
            (blob) => {
              if (!blob) {
                return resolve(file);
              }

              // 새 파일명 (.jpg로 표준화)
              const originalName = file.name.substring(0, file.name.lastIndexOf('.')) || file.name;
              const compressedFile = new File([blob], `${originalName}.jpg`, {
                type: 'image/jpeg',
                lastModified: Date.now(),
              });

              // 만약 압축된 파일이 원본보다 크면 원본 사용 (작은 이미지 보호)
              if (compressedFile.size >= file.size) {
                return resolve(file);
              }

              resolve(compressedFile);
            },
            'image/jpeg',
            quality
          );
        };

        img.onerror = () => resolve(file);
        img.src = event.target?.result;
      };

      reader.onerror = () => resolve(file);
      reader.readAsDataURL(file);
    } catch (err) {
      console.warn('Image compression fallback to original:', err);
      resolve(file);
    }
  });
}
