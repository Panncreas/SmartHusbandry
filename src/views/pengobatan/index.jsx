import React, { Component } from "react";
import { Card, Button, Table, message, Row, Col, Divider, Modal, Upload, Input } from "antd";
import { getPengobatan, deletePengobatan, editPengobatan, addPengobatan } from "@/api/pengobatan";
import {getPetugas} from "@/api/petugas";
import { read, utils } from "xlsx";
import { UploadOutlined } from '@ant-design/icons';
import moment from 'moment';
import AddPengobatanForm from './forms/add-pengobatan-form';
import EditPengobatanForm from './forms/edit-pengobatan-form';
import TypingCard from "@/components/TypingCard";
import { reqUserInfo } from "../../api/user";


class Pengobatan extends Component {
  state = {
    pengobatan: [],
    editPengobatanModalVisible: false,
    editPengobatanModalLoading: false,
    currentRowData: {},
    addPengobatanModalVisible: false,
    addPengobatanModalLoading: false,
    importModalVisible: false,
    importedData: [],
    columnTitles: [],
    fileName: "",
    uploading: false,
    importModalVisible: false,
    columnMapping: {},
    searchKeyword: "",
    user: null,
  };

  // Fungsi ambil data dari database
  getPengobatan = async () => {
    const result = await getPengobatan();
    console.log(result);
    const { content, statusCode } = result.data;

    if (statusCode === 200) {
      const filteredPengobatan = content.filter((pengobatan) => {
        const { idKasus, tanggalPengobatan, tanggalKasus,
        namaPetugas, namaInfrastruktur, lokasi, dosis,
        sindrom, diagnosaBanding } = pengobatan;
        const keyword = this.state.searchKeyword.toLowerCase();
        
        const isIdKasusValid = typeof idKasus === 'string';
        const isTanggalPengobatanValid = typeof tanggalPengobatan === 'string';
        const isTanggalKasusValid = typeof tanggalKasus === 'string';
        const isNamaPetugasValid = typeof namaPetugas === 'string';
        const isNamaInfrastrukturValid = typeof namaInfrastruktur === 'string';
        const isLokasiValid = typeof lokasi === 'string';
        const isDosisValid = typeof dosis === 'string';
        const isSindromValid = typeof sindrom === 'string';
        const isDiagnosaBandingValid = typeof diagnosaBanding === 'string';

        return (
          (isIdKasusValid && idKasus.toLowerCase().includes(keyword)) ||
          (isTanggalPengobatanValid && tanggalPengobatan.toLowerCase().includes(keyword)) ||
          (isTanggalKasusValid && tanggalKasus.toLowerCase().includes(keyword)) ||
          (isNamaPetugasValid && namaPetugas.toLowerCase().includes(keyword)) ||
          (isNamaInfrastrukturValid && namaInfrastruktur.toLowerCase().includes(keyword)) ||
          (isLokasiValid && lokasi.toLowerCase().includes(keyword)) ||
          (isDosisValid && dosis.toLowerCase().includes(keyword)) ||
          (isSindromValid && sindrom.toLowerCase().includes(keyword)) ||
          (isDiagnosaBandingValid && diagnosaBanding.toLowerCase().includes(keyword)) 
        );
      });
  
      this.setState({
        pengobatan: filteredPengobatan,
      });
    }
  };

  getPetugas = async () => {
    const result = await getPetugas();
    const { content, statusCode } = result.data;
  
    if (statusCode === 200) {
      this.setState({
        petugas: content,
      });
    }
  };
  

  handleSearch = (keyword) => {
    this.setState({
      searchKeyword: keyword,
    }, () => {
      this.getPengobatan(); 
    });
  };

  // Fungsi Import File Csv
  handleImportModalOpen = () => {
    this.setState({ importModalVisible: true });
  };
  
  handleImportModalClose = () => {
    this.setState({ importModalVisible: false });
  };

  handleFileImport = (file) => {
    const reader = new FileReader();
  
    reader.onload = (e) => {
      const data = new Uint8Array(e.target.result);
      const workbook = read(data, { type: "array" });
  
      const worksheet = workbook.Sheets[workbook.SheetNames[0]];
      const jsonData = utils.sheet_to_json(worksheet, { header: 1 });
  
      const importedData = jsonData.slice(1); // Exclude the first row (column titles)
  
      const columnTitles = jsonData[0]; // Assume the first row contains column titles
  
      // Get the file name from the imported file
      const fileName = file.name.toLowerCase();
  
      this.setState({
        importedData,
        columnTitles,
        fileName, // Set the fileName in the state
      });

      // Create column mapping
      const columnMapping = {};
      columnTitles.forEach((title, index) => {
        columnMapping[title] = index;
      });
      this.setState({ columnMapping });
    };
    reader.readAsArrayBuffer(file);
  };

  handleUpload = () => {
    const { importedData, columnMapping } = this.state;
  
    if (importedData.length === 0) {
      message.error("No data to import.");
      return;
    }
  
    this.setState({ uploading: true });
  
    this.saveImportedData(columnMapping)
      .then(() => {
        this.setState({
          uploading: false,
          importModalVisible: false,
        });
      })
      .catch((error) => {
        console.error("Gagal mengunggah data:", error);
        this.setState({ uploading: false });
        message.error("Gagal mengunggah data, harap coba lagi.");
      });
  };
  
  convertToJSDate(input) {
    let date;
    
    if (typeof input === 'number') {
      const utcDays = Math.floor(input - 25569);
      const utcValue = utcDays * 86400;
      const dateInfo = new Date(utcValue * 1000);
      date = new Date(dateInfo.getFullYear(), dateInfo.getMonth(), dateInfo.getDate()).toString();
    } else if (typeof input === 'string') {
      const [day, month, year] = input.split('/');
      date = new Date(`${year}-${month}-${day}`).toString();
    }
  
    return date;
  }

  saveImportedData = async (columnMapping) => {
    const { importedData, pengobatan, petugas } = this.state;
    let errorCount = 0;
  
    try {
      for (const row of importedData) {
        const petugasNama = row[columnMapping["Petugas"]].toLowerCase();
        const petugasData = petugas.find(p => p.namaPetugas.toLowerCase() === petugasNama);
        const petugasId = petugasData ? petugasData.nikPetugas : null;
        console.log(`Mencocokkan nama petugas: ${petugasNama}, Ditemukan: ${petugasData ? 'Ya' : 'Tidak'}, petugasId: ${petugasId}`);
        const dataToSave = {
          idKasus: row[columnMapping["ID Kasus"]],
          tanggalPengobatan: this.convertToJSDate(row[columnMapping["tanggal_pengobatan"]]),
          tanggalKasus: this.convertToJSDate(row[columnMapping["tanggal_kasus"]]),
          petugas_id: row[columnMapping["Petugas"]],
          namaInfrastruktur: row[columnMapping["Nama Infrasruktur"]],
          lokasi: row[columnMapping["Lokasi"]],
          dosis: row[columnMapping["Dosis"]],
          sindrom: row[columnMapping["Tanda/Sindrom"]],
          diagnosaBanding: row[columnMapping["Diagnosa Banding"]],
        };
  
        const existingPengobatanIndex = pengobatan.findIndex(p => p.idKasus === dataToSave.idKasus);
  
        try {
          if (existingPengobatanIndex > -1) {
            // Update existing data
            await editPengobatan(dataToSave, dataToSave.idKasus);
            this.setState((prevState) => {
              const updatedPengobatan = [...prevState.pengobatan];
              updatedPengobatan[existingPengobatanIndex] = dataToSave;
              return { pengobatan: updatedPengobatan };
            });
          } else {
            // Add new data
            await addPengobatan(dataToSave);
            this.setState((prevState) => ({
              pengobatan: [...prevState.pengobatan, dataToSave],
            }));
          }
        } catch (error) {
          errorCount++;
          console.error("Gagal menyimpan data:", error);
        }
      }
  
      if (errorCount === 0) {
        message.success(`Semua data berhasil disimpan.`);
      } else {
        message.error(`${errorCount} data gagal disimpan, harap coba lagi!`);
      }
  
    } catch (error) {
      console.error("Gagal memproses data:", error);
    } finally {
      this.setState({
        importedData: [],
        columnTitles: [],
        columnMapping: {},
      });
    }
  };
  

  // Fungsi Edit Pengobatan
  handleEditPengobatan = (row) => {
    this.setState({
      currentRowData: Object.assign({}, row),
      editPengobatanModalVisible: true,
    });
  };

  handleEditPengobatanOk = (_) => {
    const { form } = this.editPengobatanFormRef.props;
    form.validateFields((err, values) => {
      if (err) {
        return;
      }
      this.setState({ editModalLoading: true });
      editPengobatan(values, values.idKasus)
        .then((response) => {
          form.resetFields();
          this.setState({
            editPengobatanModalVisible: false,
            editPengobatanModalLoading: false,
          });
          message.success("Berhasil diedit!");
          this.getPengobatan();
        })
        .catch((e) => {
          message.success("Pengeditan gagal, harap coba lagi!");
        });
    });
  };

  handleDeletePengobatan = (row) => {
    const { idKasus } = row;
    Modal.confirm({
      title: "Konfirmasi",
      content: "Apakah Anda yakin ingin menghapus data ini?",
      okText: "Ya",
      okType: "danger",
      cancelText: "Tidak",
      onOk: () => {
        deletePengobatan({ idKasus }).then((res) => {
          message.success("Berhasil dihapus");
          this.getPengobatan();
        });
      },
    });
  };

  handleCancel = (_) => {
    this.setState({
      editPengobatanModalVisible: false,
      addPengobatanModalVisible: false,
    });
  };

  // Fungsi Tambahkan Pengobatan
  handleAddPengobatan = (row) => {
    this.setState({
      addPengobatanModalVisible: true,
    });
  };

  handleAddPengobatanOk = (_) => {
    const { form } = this.addPengobatanFormRef.props;
    form.validateFields((err, values) => {
      if (err) {
        return;
      }
      this.setState({ addPengobatanModalLoading: true });
      addPengobatan(values)
        .then((response) => {
          form.resetFields();
          this.setState({
            addPengobatanModalVisible: false,
            addPengobatanModalLoading: false,
          });
          message.success("Berhasil menambahkan!");
          this.getPengobatan();
        })
        .catch((e) => {
          message.success("Gagal menambahkan, harap coba lagi!");
        });
    });
  };

  componentDidMount() {
    this.getPetugas();
    this.getPengobatan();

    reqUserInfo()
      .then((response) => {
        this.setState({ user: response.data });
      })
      .catch((error) => {
        console.error("Terjadi kesalahan saat mengambil data user:", error);
      });
  };
  // Fungsi Export dari database ke file csv
  handleExportData = () => {
    const { pengobatan } = this.state;
    const csvContent = this.convertToCSV(pengobatan);
    this.downloadCSV(csvContent);
  };

  convertToCSV = (data) => {
    const columnTitles = [
      "Tanggal Pengobatan",
      "Tanggal Kasus",
      "ID Kasus",
      "Petugas",
      "Nama Infrastruktur",
      "Lokasi",
      "Dosis",
      "Tanda atau Sindrom",
      "Diagnosa Banding",
    ];

    const rows = [columnTitles];
    data.forEach((item) => {
      const row = [
        item.tanggalPengobatan,
        item.tanggalKasus,
        item.idKasus,
        item.namaPetugas,
        item.namaInfrastruktur,
        item.lokasi,
        item.dosis,
        item.sindrom,
        item.diagnosaBanding,
      ];
      rows.push(row);
    });

    let csvContent = "data:text/csv;charset=utf-8,";

    rows.forEach((rowArray) => {
      const row = rowArray.join(";");
      csvContent += row + "\r\n";
    });

    return csvContent;
  };

  downloadCSV = (csvContent) => {
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", "Pengobatan.csv");
    document.body.appendChild(link); // Required for Firefox
    link.click();
  };

  render() {
    const { pengobatan, importModalVisible, searchKeyword, user } = this.state;
    const columns = [
      { title: "ID Kasus", dataIndex: "idKasus", key: "idKasus" },
      { title: "Tanggal Pengobatan", dataIndex: "tanggalPengobatan", key: "tanggalPengobatan" },
      { title: "Tanggal Kasus", dataIndex: "tanggalKasus", key: "tanggalKasus" },
      { title: "Nama Infrastruktur", dataIndex: "namaInfrastruktur", key: "namaInfrastruktur" },
      { title: "Lokasi", dataIndex: "lokasi", key: "lokasi" },
      { title: "Dosis", dataIndex: "dosis", key: "dosis" },
      { title: "Tanda atau Sindrom", dataIndex: "sindrom", key: "sindrom" },
      { title: "Diagnosa Banding", dataIndex: "diagnosaBanding", key: "diagnosaBanding" },
      { title: "Petugas", dataIndex: "petugas.namaPetugas", key: "namaPetugas" },
    ];

    const renderTable = () => {
      if (user &&  user.role === 'ROLE_PETERNAK') {
        return <Table dataSource={pengobatan} bordered columns={columns} />;
      } else if (user && user.role === 'ROLE_ADMINISTRATOR' || 'ROLE_PETUGAS') {
        return <Table dataSource={pengobatan} bordered columns={(columns && renderColumns())}/>
      }
      else {
        return null;
      }
    };
  
    const renderButtons = () => {
      if (user && (user.role === 'ROLE_ADMINISTRATOR' || user.role === 'ROLE_PETUGAS')) {
        return (
          <Row gutter={[16, 16]} justify="start" style={{paddingLeft: 9}}>
            <Col xs={24} sm={12} md={8} lg={6} xl={6}>
              <Button type="primary" onClick={this.handleAddPengobatan}>
                Tambah Pengobatan
              </Button>
            </Col>
            <Col xs={24} sm={12} md={8} lg={6} xl={6}>
              <Button icon={<UploadOutlined />} onClick={this.handleImportModalOpen}>
                Import File
              </Button>
            </Col>
            <Col xs={24} sm={12} md={8} lg={6} xl={6}>
              <Button icon={<UploadOutlined />} onClick={this.handleExportData}>
                Export File
              </Button>
            </Col>
          </Row>
        );
      } else {
        return null;
      }
    };
  
    const renderColumns = () => {
      if (user && user.role === 'ROLE_ADMINISTRATOR' || 'ROLE_PETUGAS') {
        columns.push({
          title: "Operasi",
          key: "action",
          width: 120,
          align: "center",
          render: (text, row) => (
            <span>
              <Button
                type="primary"
                shape="circle"
                icon="edit"
                title="Edit"
                onClick={() => this.handleEditPengobatan(row)}
              />
              <Divider type="vertical" />
              <Button
                type="primary"
                shape="circle"
                icon="delete"
                title="Delete"
                onClick={() => this.handleDeletePengobatan(row)}
              />
            </span>
          ),
        });
      }
      return columns;
    };
  
    const title = (
      <Row gutter={[16, 16]} justify="start">
        {renderButtons()}
        <Col xs={24} sm={12} md={8} lg={6} xl={6}>
          <Input
            placeholder="Cari data"
            value={searchKeyword}
            onChange={(e) => this.handleSearch(e.target.value)}
            style={{ width: 235, marginRight: 10 }}
          />
        </Col>
      </Row>
    );
  
    const { role } = user ? user.role : '';
    console.log("peran pengguna:",role);
    const cardContent = `Di sini, Anda dapat mengelola daftar pengobatan di sistem.`;
    return (
      <div className="app-container">
        <TypingCard title="Manajemen Data Pengobatan" source={cardContent} />
        <br />
        <Card title={title} style={{ overflowX: "scroll" }}>
        {renderTable()}
        </Card>
        <EditPengobatanForm
          currentRowData={this.state.currentRowData}
          wrappedComponentRef={(formRef) =>
            (this.editPengobatanFormRef = formRef)
          }
          visible={this.state.editPengobatanModalVisible}
          confirmLoading={this.state.editPengobatanModalLoading}
          onCancel={this.handleCancel}
          onOk={this.handleEditPengobatanOk}
        />
        <AddPengobatanForm
          wrappedComponentRef={(formRef) =>
            (this.addPengobatanFormRef = formRef)
          }
          visible={this.state.addPengobatanModalVisible}
          confirmLoading={this.state.addPengobatanModalLoading}
          onCancel={this.handleCancel}
          onOk={this.handleAddPengobatanOk}
        />
        <Modal
          title="Import File"
          visible={importModalVisible}
          onCancel={this.handleImportModalClose}
          footer={[
            <Button key="cancel" onClick={this.handleImportModalClose}>
              Cancel
            </Button>,
            <Button
              key="upload"
              type="primary"
              loading={this.state.uploading}
              onClick={this.handleUpload}
            >
              Upload
            </Button>,
          ]}
        >
          <Upload beforeUpload={this.handleFileImport}>
            <Button icon={<UploadOutlined />}>Pilih File</Button>
          </Upload>
        </Modal>
      </div>
    );
  }
}

export default Pengobatan;
